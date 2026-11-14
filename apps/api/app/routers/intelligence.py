"""Locations, climate, soil, vegetation, crops, recommendations, risk and satellite layer catalog."""
import statistics
import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.data.crops import SEASONS
from app.data.reference import DISTRICT_BY_NAME, DISTRICTS
from app.db import get_db
from app.deps import OrgContext, api_error, require
from app.models import CropCatalog, CropRecommendation, CropRequirement, Farm, MarketPrice, RiskAssessment, SatelliteDataSource
from app.schemas import RecommendIn
from app.services import crop_engine, nasa_power, risk
from app.services.http import UpstreamError

router = APIRouter(tags=["intelligence"])


def provenance(db: Session, key: str, **extra) -> dict:
    s = db.get(SatelliteDataSource, key)
    if not s:
        return {"source_key": key, **extra}
    return {"source_key": key, "provider": s.provider, "mission": s.mission, "product": s.product,
            "spatial_resolution": s.spatial_resolution, "temporal_resolution": s.temporal_resolution,
            "status": s.status, "url": s.url, **extra}


def district_or_404(name: str) -> dict:
    d = DISTRICT_BY_NAME.get(name.lower())
    if not d:
        raise api_error(404, "unknown_district", f"Unknown district '{name}'")
    return d


def upstream(db: Session, key: str, e: Exception):
    nasa_power.mark_failure(db, key, str(e))
    return api_error(503, "upstream_unavailable", f"{e}. Data is temporarily unavailable — no values have been substituted.")


def load_crop_params(db: Session, keys: list[str] | None = None) -> dict[str, dict]:
    q = db.query(CropRequirement, CropCatalog).join(CropCatalog, CropCatalog.key == CropRequirement.crop_key)
    out = {}
    for req, cat in q.all():
        if keys and cat.key not in keys:
            continue
        out[cat.key] = {**req.params, "name": cat.name, "reviewed": req.reviewed}
    return out


def season_baseline(db: Session, lat: float, lon: float, season: str) -> dict:
    try:
        clim = nasa_power.fetch_climatology(lat, lon)
    except (UpstreamError, ValueError) as e:
        raise upstream(db, "nasa_power_climatology", e)
    sc = nasa_power.seasonal_climate(clim, SEASONS[season]["months"])
    sc["provenance"] = provenance(db, "nasa_power_climatology", period="2001–2020 climatology", data_class="historical")
    return sc


# --------------------------------------------------------------- locations
@router.get("/locations/districts")
def districts():
    return {"items": DISTRICTS, "note": "Approximate centroids for point sampling of coarse gridded products."}


@router.get("/locations/provinces")
def provinces():
    out: dict[str, list[str]] = {}
    for d in DISTRICTS:
        out.setdefault(d["province"], []).append(d["name"])
    return {"items": [{"name": k, "districts": v} for k, v in out.items()]}


# --------------------------------------------------------------- climate
def _point(lat: float | None, lon: float | None, district: str | None) -> tuple[float, float, str | None]:
    if district:
        d = district_or_404(district)
        return d["lat"], d["lon"], d["name"]
    if lat is None or lon is None:
        raise api_error(422, "location_required", "Provide district or lat & lon")
    return lat, lon, None


@router.get("/climate/daily")
def climate_daily(district: str | None = None, lat: float | None = Query(None, ge=5.7, le=10.0), lon: float | None = Query(None, ge=79.4, le=82.1),
                  start: date | None = None, end: date | None = None,
                  ctx: OrgContext = Depends(require("intel:read", "climate")), db: Session = Depends(get_db)):
    lat, lon, dname = _point(lat, lon, district)
    if not start or not end:
        start, end = nasa_power.default_range(90)
    try:
        rows, meta = nasa_power.get_daily_cached(db, lat, lon, start, end)
    except (UpstreamError, ValueError) as e:
        raise upstream(db, "nasa_power_daily", e) if isinstance(e, UpstreamError) else api_error(422, "invalid_request", str(e))
    series = [{"date": r.obs_date.isoformat(), "t2m": r.t2m, "t2m_max": r.t2m_max, "t2m_min": r.t2m_min, "rh2m": r.rh2m,
               "precip_mm": r.precip_mm, "solar_kwh_m2": r.solar_kwh_m2, "wind_ms": r.wind_ms} for r in rows]
    precip = [s["precip_mm"] for s in series if s["precip_mm"] is not None]
    temps = [s["t2m"] for s in series if s["t2m"] is not None]
    fetched = max((r.fetched_at for r in rows), default=None)
    return {
        "location": {"district": dname, "lat": lat, "lon": lon}, "start": start, "end": end,
        "summary": {"total_precip_mm": round(sum(precip), 1) if precip else None, "mean_temp_c": round(statistics.mean(temps), 2) if temps else None,
                    "max_temp_c": max((s["t2m_max"] for s in series if s["t2m_max"] is not None), default=None),
                    "heavy_rain_days_50mm": sum(1 for p in precip if p >= 50), "dry_days_lt1mm": sum(1 for p in precip if p < 1),
                    "missing_days": sum(1 for s in series if s["precip_mm"] is None)},
        "series": series,
        "provenance": provenance(db, "nasa_power_daily", processed_at=fetched, cache_hit=meta["cache_hit"], data_class="historical",
                                 note="Observation dates are historical; POWER lags real time by a few days."),
    }


@router.get("/climate/anomaly")
def climate_anomaly(district: str, days: int = Query(30, ge=7, le=180), ctx: OrgContext = Depends(require("intel:read", "climate")),
                    db: Session = Depends(get_db)):
    """Rainfall over the last N available days vs. the 2001–2020 POWER climatology for the same months."""
    d = district_or_404(district)
    start, end = nasa_power.default_range(days)
    try:
        rows, _ = nasa_power.get_daily_cached(db, d["lat"], d["lon"], start, end)
        clim = nasa_power.fetch_climatology(d["lat"], d["lon"])
    except UpstreamError as e:
        raise upstream(db, "nasa_power_daily", e)
    observed = sum(r.precip_mm or 0 for r in rows)
    normal = 0.0
    day = start
    while day <= end:
        normal += clim["PRECTOTCORR"][day.month] or 0
        day += timedelta(days=1)
    anomaly = risk.rainfall_anomaly_pct(observed, normal)
    max_t = max((r.t2m_max for r in rows if r.t2m_max is not None), default=None)
    heavy = sum(1 for r in rows if (r.precip_mm or 0) >= 50)
    cr = risk.climate_risk(anomaly, max_t, heavy)
    return {"district": d["name"], "start": start, "end": end, "observed_mm": round(observed, 1), "normal_mm": round(normal, 1),
            "anomaly_pct": round(anomaly, 1) if anomaly is not None else None, "max_temp_c": max_t, "heavy_rain_days": heavy,
            "climate_risk": cr, "data_class": "historical",
            "provenance": [provenance(db, "nasa_power_daily"), provenance(db, "nasa_power_climatology", period="2001–2020")]}


@router.get("/climate/season-baseline")
def climate_season(district: str, season: str = Query(..., pattern="^(maha|yala)$"),
                   ctx: OrgContext = Depends(require("intel:read")), db: Session = Depends(get_db)):
    d = district_or_404(district)
    return {"district": d["name"], "season": season, **season_baseline(db, d["lat"], d["lon"], season)}


# --------------------------------------------------------------- soil & vegetation
@router.get("/soil/moisture")
def soil_moisture(district: str, start: date | None = None, end: date | None = None,
                  ctx: OrgContext = Depends(require("intel:read", "soil_water")), db: Session = Depends(get_db)):
    d = district_or_404(district)
    if not start or not end:
        start, end = nasa_power.default_range(90)
    try:
        rows = nasa_power.get_soil_wetness_cached(db, d["lat"], d["lon"], start, end)
    except UpstreamError as e:
        raise upstream(db, "nasa_power_soil_wetness", e)
    root = [r.root_zone for r in rows if r.root_zone is not None]
    smap = db.get(SatelliteDataSource, "smap_l3_enhanced")
    return {
        "district": d["name"], "start": start, "end": end,
        "series": [{"date": r.obs_date.isoformat(), "surface": r.surface, "root_zone": r.root_zone} for r in rows],
        "summary": {"root_zone_mean": round(statistics.mean(root), 3) if root else None, "latest_root_zone": root[-1] if root else None,
                    "days_below_0_3": sum(1 for v in root if v < 0.3),
                    "water_stress": None if not root else ("high" if root[-1] < 0.25 else "moderate" if root[-1] < 0.4 else "low")},
        "provenance": provenance(db, "nasa_power_soil_wetness", data_class="historical",
                                 limitation="Model reanalysis (MERRA-2) at ~50 km — regional indicator only, not field-level soil moisture."),
        "smap_status": {"product": smap.product if smap else None, "status": smap.status if smap else "not_configured",
                        "message": "SMAP satellite soil moisture ingestion requires Earthdata credentials and raster processing (Phase 4)."},
    }


@router.get("/vegetation/ndvi")
def ndvi(farm_id: uuid.UUID | None = None, ctx: OrgContext = Depends(require("intel:read")), db: Session = Depends(get_db)):
    src = db.get(SatelliteDataSource, "sentinel2_l2a")
    return {"available": False, "series": [], "provenance": provenance(db, "sentinel2_l2a"),
            "message": "NDVI is unavailable: Sentinel-2 (Copernicus) access is not configured. "
                       "Set COPERNICUS credentials and enable the ingestion worker. No values are fabricated.",
            "status": src.status if src else "not_configured"}


# --------------------------------------------------------------- satellite layers catalog
LAYERS = [
    {"id": "rainfall_daily_point", "name": "Rainfall (district points)", "source_key": "nasa_power_daily", "kind": "point", "unit": "mm"},
    {"id": "soil_wetness_point", "name": "Root-zone soil wetness (district points)", "source_key": "nasa_power_soil_wetness", "kind": "point", "unit": "fraction"},
    {"id": "rainfall_imerg", "name": "Rainfall accumulation (GPM IMERG raster)", "source_key": "gpm_imerg_final", "kind": "raster", "unit": "mm"},
    {"id": "soil_moisture_smap", "name": "Soil moisture (SMAP raster)", "source_key": "smap_l3_enhanced", "kind": "raster", "unit": "m³/m³"},
    {"id": "ndvi_s2", "name": "NDVI (Sentinel-2)", "source_key": "sentinel2_l2a", "kind": "raster", "unit": "index"},
    {"id": "drought_risk", "name": "Drought risk", "source_key": "nasa_power_daily", "kind": "derived", "unit": "0–100"},
    {"id": "flood_exposure", "name": "Flood exposure", "source_key": None, "kind": "raster", "unit": "class"},
    {"id": "elevation", "name": "Elevation / terrain", "source_key": None, "kind": "raster", "unit": "m"},
    {"id": "crop_suitability", "name": "Crop suitability", "source_key": "nasa_power_climatology", "kind": "derived", "unit": "0–100"},
]


@router.get("/satellite/layers")
def satellite_layers(ctx: OrgContext = Depends(require("intel:read", "map")), db: Session = Depends(get_db)):
    out = []
    for layer in LAYERS:
        src = db.get(SatelliteDataSource, layer["source_key"]) if layer["source_key"] else None
        available = bool(src and src.status in ("operational", "degraded") and layer["kind"] != "raster")
        reason = None if available else (
            "No processed raster tiles yet — requires credentialed ingestion and raster processing." if layer["kind"] == "raster"
            else "Source not operational.") if src else "No data source configured for this layer."
        warning = "Recent requests to this source failed; data may be incomplete." if src and src.status == "degraded" else None
        out.append({**layer, "available": available, "unavailable_reason": reason, "warning": warning,
                    "provenance": provenance(db, layer["source_key"]) if layer["source_key"] else None})
    return {"items": out}


@router.get("/satellite/district-snapshot")
def district_snapshot(district: str, ctx: OrgContext = Depends(require("intel:read", "map")), db: Session = Depends(get_db)):
    """Intelligence panel for a district: recent rainfall/temperature, soil wetness, risk and quick crop ranking."""
    d = district_or_404(district)
    start, end = nasa_power.default_range(30)
    errors = {}
    climate = soil = None
    try:
        rows, _ = nasa_power.get_daily_cached(db, d["lat"], d["lon"], start, end)
        precip = [r.precip_mm for r in rows if r.precip_mm is not None]
        temps = [r.t2m for r in rows if r.t2m is not None]
        climate = {"rain_30d_mm": round(sum(precip), 1), "mean_temp_c": round(statistics.mean(temps), 1) if temps else None,
                   "start": start, "end": end}
    except UpstreamError as e:
        nasa_power.mark_failure(db, "nasa_power_daily", str(e))
        errors["climate"] = str(e)
    try:
        srows = nasa_power.get_soil_wetness_cached(db, d["lat"], d["lon"], start, end)
        root = [r.root_zone for r in srows if r.root_zone is not None]
        soil = {"root_zone_latest": root[-1] if root else None}
    except UpstreamError as e:
        errors["soil"] = str(e)
    return {"district": d, "climate": climate, "soil": soil, "vegetation": {"available": False, "reason": "Sentinel-2 not configured"},
            "errors": errors, "provenance": [provenance(db, "nasa_power_daily"), provenance(db, "nasa_power_soil_wetness")]}


# --------------------------------------------------------------- crops & recommendations
@router.get("/crops")
def crops(db: Session = Depends(get_db)):
    params = load_crop_params(db)
    reqs = {r.crop_key: r for r in db.query(CropRequirement).all()}
    return {"items": [{"key": k, **v, "source_note": reqs[k].source_note} for k, v in params.items()], "seasons": SEASONS,
            "engine_version": crop_engine.ENGINE_VERSION}


@router.post("/recommendations")
def recommend(body: RecommendIn, ctx: OrgContext = Depends(require("intel:read", "crop_suitability")), db: Session = Depends(get_db)):
    d = district_or_404(body.district)
    lat, lon = d["lat"], d["lon"]
    if body.farm_id:
        f = db.query(Farm).filter_by(id=body.farm_id, org_id=ctx.org.id).one_or_none()
        if not f:
            raise api_error(404, "not_found", "Farm not found")
        lat, lon = f.latitude, f.longitude
    prov = None
    if body.mean_temp_c is None or body.rainfall_mm is None:
        base = season_baseline(db, lat, lon, body.season)
        temp, rain, elev, prov = base["mean_temp_c"], base["rainfall_mm"], body.elevation_m or base["elevation_m"], base["provenance"]
    else:
        temp, rain, elev = body.mean_temp_c, body.rainfall_mm, body.elevation_m
    params = load_crop_params(db, body.crops)
    if not params:
        raise api_error(422, "no_crops", "No matching crops")
    result = crop_engine.recommend(params, mean_temp_c=temp, rainfall_mm=rain, irrigation=body.irrigation,
                                   elevation_m=elev, soil_moisture_root=body.soil_moisture_root)
    inputs = {"district": d["name"], "season": body.season, "irrigation": body.irrigation, "mean_temp_c": temp,
              "rainfall_mm": rain, "elevation_m": elev, "soil_moisture_root": body.soil_moisture_root,
              "climate_source": "NASA POWER climatology 2001–2020" if prov else "user-supplied"}
    rec = CropRecommendation(org_id=ctx.org.id, farm_id=body.farm_id, district=d["name"], season=body.season, inputs=inputs,
                             result=result, model_version=crop_engine.ENGINE_VERSION, created_by=ctx.user.id)
    db.add(rec)
    db.commit()
    return {"id": str(rec.id), "inputs": inputs, **result, "provenance": prov,
            "crop_parameters_reviewed": all(p.get("reviewed") for p in params.values())}


# --------------------------------------------------------------- risk
@router.get("/risk/district")
def district_risk(district: str, crop: str = "paddy", season: str = Query("maha", pattern="^(maha|yala)$"),
                  ctx: OrgContext = Depends(require("intel:read", "risk")), db: Session = Depends(get_db)):
    anomaly = climate_anomaly(district, 30, ctx, db)
    d = district_or_404(district)
    base = season_baseline(db, d["lat"], d["lon"], season)
    params = load_crop_params(db, [crop])
    if not params:
        raise api_error(404, "unknown_crop", "Unknown crop")
    suit = crop_engine.score_crop(crop, params[crop], mean_temp_c=base["mean_temp_c"], rainfall_mm=base["rainfall_mm"],
                                  elevation_m=base["elevation_m"])
    prices = [p.price_lkr_per_kg for p in db.query(MarketPrice).filter_by(commodity=crop).order_by(MarketPrice.price_date.desc()).limit(52)]
    clim, prod, mkt = anomaly["climate_risk"], risk.production_risk(suit["score"], suit["water_balance"]["satisfaction"]), risk.market_risk(prices)
    result = {"climate": clim, "production": prod, "market": mkt, "overall": risk.overall(clim, prod, mkt)}
    db.add(RiskAssessment(org_id=ctx.org.id, district=d["name"], inputs={"crop": crop, "season": season, "anomaly": anomaly["anomaly_pct"]},
                          result=result, method_version=risk.METHOD_VERSION))
    db.commit()
    return {"district": d["name"], "crop": crop, "season": season, "method_version": risk.METHOD_VERSION, **result,
            "label": "Decision-support estimate — not a validated underwriting or credit decision."}
