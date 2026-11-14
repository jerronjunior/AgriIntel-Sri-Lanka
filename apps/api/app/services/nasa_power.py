"""NASA POWER client (https://power.larc.nasa.gov/docs/services/api/).

Daily point data for the AG community, plus the 2001–2020 climatology endpoint. Responses are
validated, fill values (-999) mapped to None, and daily rows cached in `climate_observations`.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta

import httpx
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import ClimateObservation, SatelliteDataSource, SoilMoistureObservation
from app.services.http import UpstreamError, get_json

DAILY_PARAMS = {
    "T2M": "t2m", "T2M_MAX": "t2m_max", "T2M_MIN": "t2m_min", "RH2M": "rh2m",
    "PRECTOTCORR": "precip_mm", "ALLSKY_SFC_SW_DWN": "solar_kwh_m2", "WS2M": "wind_ms",
}
SOIL_PARAMS = {"GWETTOP": "surface", "GWETROOT": "root_zone"}
CLIMATOLOGY_PARAMS = ["T2M", "T2M_MAX", "T2M_MIN", "PRECTOTCORR", "RH2M"]
MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
DAYS_IN_MONTH = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
SRI_LANKA_BBOX = (5.7, 79.4, 10.0, 82.1)  # lat_min, lon_min, lat_max, lon_max


def _round(v: float) -> float:
    return round(v, 2)


def validate_point(lat: float, lon: float) -> None:
    la0, lo0, la1, lo1 = SRI_LANKA_BBOX
    if not (la0 <= lat <= la1 and lo0 <= lon <= lo1):
        raise ValueError("Coordinates must fall within Sri Lanka (lat 5.7–10.0, lon 79.4–82.1)")


@dataclass
class PowerDaily:
    lat: float
    lon: float
    elevation_m: float | None
    rows: list[dict] = field(default_factory=list)
    units: dict = field(default_factory=dict)
    fill_value: float = -999.0


def parse_daily(payload: dict, mapping: dict[str, str]) -> PowerDaily:
    try:
        coords = payload["geometry"]["coordinates"]
        params = payload["properties"]["parameter"]
    except (KeyError, TypeError) as e:
        raise UpstreamError("NASA POWER", f"unexpected response shape: missing {e}")
    fill = float(payload.get("header", {}).get("fill_value", -999.0))
    units = {k: v.get("units") for k, v in payload.get("parameters", {}).items() if isinstance(v, dict)}
    dates: set[str] = set()
    for series in params.values():
        dates.update(series.keys())
    rows = []
    for d in sorted(dates):
        try:
            obs_date = datetime.strptime(d, "%Y%m%d").date()
        except ValueError:
            continue
        row = {"obs_date": obs_date}
        for api_key, col in mapping.items():
            v = params.get(api_key, {}).get(d)
            row[col] = None if v is None or float(v) == fill else float(v)
        rows.append(row)
    elev = coords[2] if len(coords) > 2 else None
    return PowerDaily(lat=coords[1], lon=coords[0], elevation_m=elev, rows=rows, units=units, fill_value=fill)


def fetch_daily(lat: float, lon: float, start: date, end: date, params: dict[str, str] = DAILY_PARAMS,
                client: httpx.Client | None = None) -> PowerDaily:
    validate_point(lat, lon)
    if end < start:
        raise ValueError("end must be on/after start")
    if (end - start).days > 366 * 5:
        raise ValueError("date range limited to 5 years per request")
    s = get_settings()
    payload = get_json("NASA POWER", f"{s.NASA_POWER_BASE_URL}/temporal/daily/point", params={
        "parameters": ",".join(params.keys()), "community": "AG", "latitude": lat, "longitude": lon,
        "start": start.strftime("%Y%m%d"), "end": end.strftime("%Y%m%d"), "format": "JSON",
    }, client=client)
    return parse_daily(payload, params)


def fetch_climatology(lat: float, lon: float, client: httpx.Client | None = None) -> dict:
    """Monthly 2001–2020 normals. Returns {param: {month_index(1-12): value}, 'elevation_m': ...}."""
    validate_point(lat, lon)
    s = get_settings()
    payload = get_json("NASA POWER", f"{s.NASA_POWER_BASE_URL}/temporal/climatology/point", params={
        "parameters": ",".join(CLIMATOLOGY_PARAMS), "community": "AG", "latitude": lat, "longitude": lon, "format": "JSON",
    }, client=client)
    try:
        params = payload["properties"]["parameter"]
        coords = payload["geometry"]["coordinates"]
    except (KeyError, TypeError) as e:
        raise UpstreamError("NASA POWER", f"unexpected climatology response: missing {e}")
    fill = float(payload.get("header", {}).get("fill_value", -999.0))
    out: dict = {"elevation_m": coords[2] if len(coords) > 2 else None}
    for p in CLIMATOLOGY_PARAMS:
        series = params.get(p, {})
        out[p] = {i + 1: (None if series.get(m) in (None, fill) else float(series[m])) for i, m in enumerate(MONTHS)}
    return out


def seasonal_climate(clim: dict, months: list[int]) -> dict:
    """Season mean temperature and total rainfall (mm) from monthly climatology."""
    temps = [clim["T2M"][m] for m in months if clim["T2M"].get(m) is not None]
    rain = sum((clim["PRECTOTCORR"][m] or 0) * DAYS_IN_MONTH[m - 1] for m in months)
    tmax = [clim["T2M_MAX"][m] for m in months if clim["T2M_MAX"].get(m) is not None]
    return {
        "mean_temp_c": round(sum(temps) / len(temps), 2) if temps else None,
        "mean_tmax_c": round(sum(tmax) / len(tmax), 2) if tmax else None,
        "rainfall_mm": round(rain, 1),
        "elevation_m": clim.get("elevation_m"),
    }


# ------------------------------------------------------------------ DB caching
def get_daily_cached(db: Session, lat: float, lon: float, start: date, end: date,
                     client: httpx.Client | None = None) -> tuple[list[ClimateObservation], dict]:
    lat, lon = _round(lat), _round(lon)
    q = select(ClimateObservation).where(
        ClimateObservation.source_key == "nasa_power_daily", ClimateObservation.lat == lat,
        ClimateObservation.lon == lon, ClimateObservation.obs_date.between(start, end),
    ).order_by(ClimateObservation.obs_date)
    existing = db.scalars(q).all()
    expected = (end - start).days + 1
    cache_hit = len(existing) >= expected
    if not cache_hit:
        data = fetch_daily(lat, lon, start, end, client=client)
        if data.rows:
            stmt = pg_insert(ClimateObservation).values([
                {"source_key": "nasa_power_daily", "lat": lat, "lon": lon, **r, "fetched_at": datetime.now(UTC)} for r in data.rows
            ])
            stmt = stmt.on_conflict_do_update(
                index_elements=["source_key", "lat", "lon", "obs_date"],
                set_={c: stmt.excluded[c] for c in [*DAILY_PARAMS.values(), "fetched_at"]},
            )
            db.execute(stmt)
        _mark_source(db, "nasa_power_daily", ok=True)
        db.commit()
        existing = db.scalars(q).all()
    return existing, {"cache_hit": cache_hit}


def get_soil_wetness_cached(db: Session, lat: float, lon: float, start: date, end: date,
                            client: httpx.Client | None = None) -> list[SoilMoistureObservation]:
    lat, lon = _round(lat), _round(lon)
    q = select(SoilMoistureObservation).where(
        SoilMoistureObservation.source_key == "nasa_power_soil_wetness", SoilMoistureObservation.lat == lat,
        SoilMoistureObservation.lon == lon, SoilMoistureObservation.obs_date.between(start, end),
    ).order_by(SoilMoistureObservation.obs_date)
    existing = db.scalars(q).all()
    if len(existing) < (end - start).days + 1:
        data = fetch_daily(lat, lon, start, end, params=SOIL_PARAMS, client=client)
        if data.rows:
            stmt = pg_insert(SoilMoistureObservation).values([
                {"source_key": "nasa_power_soil_wetness", "lat": lat, "lon": lon, "units": "fraction (0–1)", **r} for r in data.rows
            ])
            stmt = stmt.on_conflict_do_update(index_elements=["source_key", "lat", "lon", "obs_date"],
                                              set_={"surface": stmt.excluded.surface, "root_zone": stmt.excluded.root_zone})
            db.execute(stmt)
        _mark_source(db, "nasa_power_soil_wetness", ok=True)
        db.commit()
        existing = db.scalars(q).all()
    return existing


def _mark_source(db: Session, key: str, ok: bool, error: str | None = None) -> None:
    src = db.get(SatelliteDataSource, key)
    if not src:
        return
    if ok:
        src.status, src.last_success_at, src.last_error = "operational", datetime.now(UTC), None
    else:
        src.status, src.last_error = "degraded", (error or "")[:1000]


def mark_failure(db: Session, key: str, error: str) -> None:
    db.rollback()
    _mark_source(db, key, ok=False, error=error)
    db.commit()


def default_range(days: int = 90) -> tuple[date, date]:
    # POWER typically lags a few days behind real time.
    end = date.today() - timedelta(days=5)
    return end - timedelta(days=days - 1), end
