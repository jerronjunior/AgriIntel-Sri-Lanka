"""NASA POWER (https://power.larc.nasa.gov) — public, no account. Daily weather + soil wetness and 2001–2020 normals."""
from datetime import date, datetime

from . import districts, store
from .config import settings
from .http import UpstreamError, get_json

DAILY = {"T2M": "t2m", "T2M_MAX": "t2m_max", "T2M_MIN": "t2m_min", "RH2M": "rh2m", "PRECTOTCORR": "power_precip_mm",
         "ALLSKY_SFC_SW_DWN": "solar_kwh_m2", "WS2M": "wind_ms", "GWETTOP": "merra2_surface_wetness", "GWETROOT": "merra2_rootzone_wetness"}
UNITS = {"t2m": "°C", "t2m_max": "°C", "t2m_min": "°C", "rh2m": "%", "power_precip_mm": "mm/day", "solar_kwh_m2": "kWh/m²/day",
         "wind_ms": "m/s", "merra2_surface_wetness": "0–1", "merra2_rootzone_wetness": "0–1"}
NORMALS = ["T2M", "T2M_MAX", "T2M_MIN", "PRECTOTCORR", "RH2M"]
MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]


def parse_daily(payload: dict, place: str) -> list[dict]:
    try:
        params = payload["properties"]["parameter"]
    except (KeyError, TypeError) as e:
        raise UpstreamError("NASA POWER", f"unexpected response: missing {e}")
    fill = float(payload.get("header", {}).get("fill_value", -999.0))
    rows = []
    for api_key, metric in DAILY.items():
        for d, v in (params.get(api_key) or {}).items():
            if v is None or float(v) == fill:
                continue  # missing days stay missing — never filled in
            rows.append({"dataset": "nasa_power", "place": place, "date": datetime.strptime(d, "%Y%m%d").date(),
                         "metric": metric, "value": float(v), "units": UNITS[metric]})
    return rows


def fetch_daily(db, start: date, end: date, places: list[str] | None = None) -> dict:
    s = settings()
    done, errors = 0, []
    for name in places or districts.names():
        p = districts.info()[name]
        try:
            payload = get_json("NASA POWER", f"{s.power_url}/temporal/daily/point", params={
                "parameters": ",".join(DAILY), "community": "AG", "latitude": p["lat"], "longitude": p["lon"],
                "start": start.strftime("%Y%m%d"), "end": end.strftime("%Y%m%d"), "format": "JSON"})
            store.upsert(db, parse_daily(payload, name))
            done += 1
        except UpstreamError as e:
            errors.append(f"{name}: {e}")
    store.mark(db, "nasa_power", done > 0, errors[0] if errors and not done else None)
    return {"districts": done, "errors": errors[:5]}


def fetch_normals(db, places: list[str] | None = None) -> dict:
    s = settings()
    done, errors = 0, []
    for name in places or districts.names():
        p = districts.info()[name]
        try:
            payload = get_json("NASA POWER", f"{s.power_url}/temporal/climatology/point", params={
                "parameters": ",".join(NORMALS), "community": "AG", "latitude": p["lat"], "longitude": p["lon"], "format": "JSON"})
            par = payload["properties"]["parameter"]
            elev = (payload.get("geometry", {}).get("coordinates") or [None, None, None])[2]
            fill = float(payload.get("header", {}).get("fill_value", -999.0))
            db.executemany("INSERT INTO normals (place, month, param, value, elevation_m, fetched_at) VALUES (?,?,?,?,?,?) "
                           "ON CONFLICT(place, month, param) DO UPDATE SET value=excluded.value, elevation_m=excluded.elevation_m, fetched_at=excluded.fetched_at",
                           [(name, i + 1, k, None if par[k].get(m) in (None, fill) else float(par[k][m]), elev, store.now())
                            for k in NORMALS for i, m in enumerate(MONTHS)])
            db.commit()
            done += 1
        except (UpstreamError, KeyError) as e:
            errors.append(f"{name}: {e}")
    store.mark(db, "nasa_power", done > 0, errors[0] if errors and not done else None)
    return {"districts": done, "errors": errors[:5]}
