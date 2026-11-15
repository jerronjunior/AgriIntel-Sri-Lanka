"""Optional JSON API for websites:  python -m nasa_kit serve --port 8090

GET /datasets                     sources, status, weights
GET /districts                    every district (same shape as sri_lanka_nasa.json "districts")
GET /districts/{name}             one district
GET /national?metric=ndvi         latest value per district (for map colouring)
GET /series/{name}?metric=precip_mm&days=180
"""
from datetime import date, timedelta

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from . import districts, export, store
from .config import settings

METRICS = {"precip_mm", "ndvi", "lst_c", "et_daily", "smap_rootzone_wetness", "smap_surface_sm", "elevation_mean", "elevation_std",
           "t2m", "t2m_max", "power_precip_mm", "rh2m", "solar_kwh_m2", "wind_ms", "merra2_rootzone_wetness"}

app = FastAPI(title="NASA Data Kit — Sri Lanka", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"], allow_headers=["*"])


def _db():
    return store.connect(settings().db_path)


def _name(n: str) -> str:
    hit = next((x for x in districts.names() if x.lower() == n.lower()), None)
    if not hit:
        raise HTTPException(404, f"Unknown district '{n}'")
    return hit


@app.get("/datasets")
def datasets():
    db = _db()
    d = export.build(db)
    return {"sources": d["sources"], "weights": d["weights"], "attribution": d["attribution"], "generated_at": d["generated_at"]}


@app.get("/districts")
def all_districts():
    q = export.Q(_db())
    return {n: export.district(q, n) for n in districts.names()}


@app.get("/districts/{name}")
def one(name: str):
    return export.district(export.Q(_db()), _name(name))


@app.get("/national")
def national(metric: str):
    if metric not in METRICS:
        raise HTTPException(422, f"metric must be one of {sorted(METRICS)}")
    q = export.Q(_db())
    out = []
    for n in districts.names():
        r = q.latest(n, metric)
        if r:
            out.append({"district": n, "value": r["value"], "date": r["date"], "dataset": r["dataset"]})
    return {"metric": metric, "items": out}


@app.get("/series/{name}")
def series(name: str, metric: str, days: int = Query(180, ge=7, le=3650)):
    if metric not in METRICS:
        raise HTTPException(422, f"metric must be one of {sorted(METRICS)}")
    s = export.Q(_db()).series(_name(name), metric, date.today() - timedelta(days=days))
    return {"district": _name(name), "metric": metric, "series": [{"date": d, "value": v, "dataset": ds} for d, v, ds in s]}


def serve(host: str, port: int) -> None:
    import uvicorn
    uvicorn.run(app, host=host, port=port)
