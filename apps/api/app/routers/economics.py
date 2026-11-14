"""Profitability, Decision Simulator, market intelligence and yield-model endpoints."""
import statistics
import uuid
from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import OrgContext, api_error, client_ip, require
from app.models import MarketPrice, MLModelRegistry, ProfitabilityScenario, Report, SimulationResult
from app.routers.intelligence import district_or_404, load_crop_params, season_baseline
from app.services import market_csv, pdf_report, profitability, simulator
from app.services.common import audit

router = APIRouter(tags=["economics"])


# --------------------------------------------------------------- profitability
class ProfitRequest(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    save: bool = False
    farm_id: uuid.UUID | None = None
    scenarios: list[profitability.ProfitInputs] = Field(min_length=1, max_length=10)


@router.post("/profitability/calculate")
def calculate(body: ProfitRequest, ctx: OrgContext = Depends(require("intel:read", "profitability")), db: Session = Depends(get_db)):
    results = profitability.rank([profitability.compute(s) for s in body.scenarios])
    for i, r in enumerate(results, 1):
        r["rank"] = i
    out = {"results": results, "data_class": "simulated", "note": "Uses your assumptions for yield, price and costs."}
    if body.save:
        sc = ProfitabilityScenario(org_id=ctx.org.id, name=body.name or "Profitability scenario", farm_id=body.farm_id,
                                   assumptions=body.model_dump(mode="json"), result=out, created_by=ctx.user.id)
        db.add(sc)
        db.commit()
        out["id"] = str(sc.id)
    return out


@router.get("/profitability/scenarios")
def list_profit(ctx: OrgContext = Depends(require("intel:read")), db: Session = Depends(get_db)):
    rows = db.query(ProfitabilityScenario).filter_by(org_id=ctx.org.id).order_by(ProfitabilityScenario.created_at.desc()).limit(100).all()
    return {"items": [{"id": str(r.id), "name": r.name, "created_at": r.created_at, "assumptions": r.assumptions, "result": r.result} for r in rows]}


# --------------------------------------------------------------- simulator
def _usage_this_month(db: Session, org_id) -> int:
    first = datetime.now(UTC).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return db.query(func.count(SimulationResult.id)).filter(SimulationResult.org_id == org_id, SimulationResult.created_at >= first).scalar()


@router.post("/simulations")
def run_simulation(body: simulator.SimulationInput, request: Request, ctx: OrgContext = Depends(require("simulations:run", "simulator")),
                   db: Session = Depends(get_db)):
    limit = (ctx.limits or {}).get("max_simulations_per_month")
    if limit is not None and _usage_this_month(db, ctx.org.id) >= limit:
        raise api_error(402, "limit_reached", f"Monthly simulation limit ({limit}) reached")
    d = district_or_404(body.district)
    if body.baseline is None:
        b = season_baseline(db, d["lat"], d["lon"], body.season)
        baseline = simulator.ClimateBaseline(mean_temp_c=b["mean_temp_c"], rainfall_mm=b["rainfall_mm"], elevation_m=b["elevation_m"],
                                             source="NASA POWER climatology 2001–2020 (historical)")
    else:
        baseline = body.baseline
    params = load_crop_params(db, [c.crop for c in body.crops])
    history = {}
    for c in body.crops:
        history[c.crop] = [p.price_lkr_per_kg for p in db.query(MarketPrice).filter_by(commodity=c.crop)
                           .order_by(MarketPrice.price_date.desc()).limit(52)]
    try:
        result = simulator.run(body, params, baseline, history)
    except ValueError as e:
        raise api_error(422, "invalid_simulation", str(e))
    inputs = body.model_dump(mode="json")
    inputs["district"] = d["name"]
    sim = SimulationResult(org_id=ctx.org.id, name=body.name, inputs=inputs, result=result,
                           engine_version=simulator.ENGINE_VERSION, created_by=ctx.user.id)
    db.add(sim)
    audit(db, "simulation.run", user_id=ctx.user.id, org_id=ctx.org.id, target_type="simulation", target_id=sim.id, ip=client_ip(request))
    db.commit()
    return {"id": str(sim.id), "name": sim.name, "inputs": inputs, **result}


@router.get("/simulations")
def list_simulations(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
                     ctx: OrgContext = Depends(require("intel:read")), db: Session = Depends(get_db)):
    q = db.query(SimulationResult).filter_by(org_id=ctx.org.id)
    total = q.count()
    rows = q.order_by(SimulationResult.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": [{"id": str(r.id), "name": r.name, "created_at": r.created_at, "district": r.inputs.get("district"),
                       "crops": [c["crop"] for c in r.inputs.get("crops", [])], "rain_change_pct": r.inputs.get("rain_change_pct")} for r in rows],
            "total": total, "page": page, "page_size": page_size}


def _sim(db: Session, ctx: OrgContext, sim_id: uuid.UUID) -> SimulationResult:
    s = db.query(SimulationResult).filter_by(id=sim_id, org_id=ctx.org.id).one_or_none()
    if not s:
        raise api_error(404, "not_found", "Simulation not found")
    return s


@router.get("/simulations/{sim_id}")
def get_simulation(sim_id: uuid.UUID, ctx: OrgContext = Depends(require("intel:read")), db: Session = Depends(get_db)):
    s = _sim(db, ctx, sim_id)
    return {"id": str(s.id), "name": s.name, "inputs": s.inputs, "created_at": s.created_at, **s.result}


@router.get("/simulations/{sim_id}/report.pdf")
def simulation_pdf(sim_id: uuid.UUID, ctx: OrgContext = Depends(require("reports:create", "reports_pdf")), db: Session = Depends(get_db)):
    s = _sim(db, ctx, sim_id)
    pdf = pdf_report.simulation_pdf(s.name, ctx.org.name, s.inputs, s.result)
    db.add(Report(org_id=ctx.org.id, kind="simulation_pdf", title=s.name, ref_id=s.id, created_by=ctx.user.id))
    db.commit()
    fname = f"agriintel-simulation-{str(s.id)[:8]}.pdf"
    return Response(pdf, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{fname}"'})


# --------------------------------------------------------------- market
@router.get("/market/prices")
def market_prices(commodity: str | None = None, district: str | None = None, start: date | None = None, end: date | None = None,
                  page: int = Query(1, ge=1), page_size: int = Query(100, ge=1, le=1000),
                  ctx: OrgContext = Depends(require("intel:read", "market")), db: Session = Depends(get_db)):
    q = db.query(MarketPrice)
    if commodity:
        q = q.filter(MarketPrice.commodity == commodity)
    if district:
        q = q.filter(func.lower(MarketPrice.district) == district.lower())
    if start:
        q = q.filter(MarketPrice.price_date >= start)
    if end:
        q = q.filter(MarketPrice.price_date <= end)
    total = q.count()
    rows = q.order_by(MarketPrice.price_date.desc()).offset((page - 1) * page_size).limit(page_size).all()
    last = db.query(func.max(MarketPrice.imported_at)).scalar()
    return {"items": [{"commodity": r.commodity, "market": r.market, "district": r.district, "price_date": r.price_date,
                       "price_type": r.price_type, "price_lkr_per_kg": r.price_lkr_per_kg, "source": r.source} for r in rows],
            "total": total, "page": page, "page_size": page_size, "last_import_at": last,
            "empty_reason": None if total else "No market prices imported yet. Import official CSV data (e.g. HARTI / Dept. of Census & Statistics)."}


@router.get("/market/summary")
def market_summary(commodity: str, ctx: OrgContext = Depends(require("intel:read", "market")), db: Session = Depends(get_db)):
    rows = db.query(MarketPrice).filter_by(commodity=commodity).order_by(MarketPrice.price_date).all()
    if not rows:
        return {"commodity": commodity, "available": False, "message": "No price data imported for this commodity."}
    prices = [r.price_lkr_per_kg for r in rows]
    by_month: dict[int, list[float]] = {}
    by_district: dict[str, list[float]] = {}
    for r in rows:
        by_month.setdefault(r.price_date.month, []).append(r.price_lkr_per_kg)
        by_district.setdefault(r.district or r.market, []).append(r.price_lkr_per_kg)
    return {"commodity": commodity, "available": True, "observations": len(rows), "latest": {"date": rows[-1].price_date, "price": rows[-1].price_lkr_per_kg, "source": rows[-1].source},
            "mean": round(statistics.mean(prices), 2), "min": min(prices), "max": max(prices),
            "cv": round(statistics.pstdev(prices) / statistics.mean(prices), 3) if len(prices) > 1 else None,
            "seasonal": [{"month": m, "mean": round(statistics.mean(v), 2), "n": len(v)} for m, v in sorted(by_month.items())],
            "districts": [{"district": k, "mean": round(statistics.mean(v), 2), "n": len(v)} for k, v in sorted(by_district.items())],
            "forecast": {"available": False, "reason": "No validated price-forecast model has been published."}}


@router.post("/market/import")
async def market_import(request: Request, file: UploadFile = File(...), ctx: OrgContext = Depends(require("market:import")),
                        db: Session = Depends(get_db)):
    raw = await file.read(market_csv.MAX_BYTES + 1)
    try:
        res = market_csv.import_csv(db, file.filename or "", raw, imported_by=ctx.user.id)
    except market_csv.CsvError as e:
        raise api_error(e.status, e.code, str(e))
    audit(db, "market.import", user_id=ctx.user.id, org_id=ctx.org.id, meta={"rows": res["upserted"], "errors": len(res["errors"]), "file": file.filename},
          ip=client_ip(request))
    db.commit()
    return res


# --------------------------------------------------------------- yield
@router.get("/yield/models")
def yield_models(ctx: OrgContext = Depends(require("intel:read")), db: Session = Depends(get_db)):
    rows = db.query(MLModelRegistry).filter_by(task="yield").order_by(MLModelRegistry.created_at.desc()).all()
    published = [r for r in rows if r.status == "published"]
    return {"items": [{"name": r.name, "version": r.version, "status": r.status, "metrics": r.metrics if r.status in ("evaluated", "published") else None,
                       "training_data": r.training_data, "created_at": r.created_at} for r in rows],
            "prediction_available": bool(published),
            "message": None if published else "No yield model has been trained and evaluated on held-out historical data yet. "
                                              "Use the Decision Simulator (assumption-based) in the meantime."}
