"""Build the Sri Lanka dataset (JSON for the website, CSV for analysis) from the local store."""
from __future__ import annotations

import csv
import json
import os
import statistics
from datetime import date, timedelta

from . import __version__, districts, store
from .catalog import CONDITION_WEIGHTS, DATASETS, SUITABILITY_WEIGHTS

DAYS_IN_MONTH = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
SEASONS = {"maha": [10, 11, 12, 1, 2], "yala": [4, 5, 6, 7, 8]}
MAX_AGE = {"ndvi": 40, "lst_c": 30, "et_daily": 30, "smap_rootzone_wetness": 14, "smap_surface_sm": 14}


def _r(v, n=2):
    return None if v is None else round(v, n)


class Q:
    def __init__(self, db):
        self.db = db

    def series(self, place: str, metric: str, start: date | None = None, end: date | None = None) -> list[tuple[str, float, str]]:
        sql, args = "SELECT obs_date, value, dataset FROM observations WHERE place=? AND metric=?", [place, metric]
        if start:
            sql, args = sql + " AND obs_date>=?", args + [start.isoformat()]
        if end:
            sql, args = sql + " AND obs_date<=?", args + [end.isoformat()]
        by_day = {}
        for d, v, ds in self.db.execute(sql + " ORDER BY obs_date", args):
            if d not in by_day or ds == "gpm_imerg_final":  # IMERG Final replaces Late for the same day
                by_day[d] = (d, v, ds)
        return list(by_day.values())

    def latest(self, place: str, metric: str, max_age: int | None = None) -> dict | None:
        sql, args = "SELECT obs_date, value, dataset FROM observations WHERE place=? AND metric=?", [place, metric]
        if max_age:
            sql, args = sql + " AND obs_date>=?", args + [(date.today() - timedelta(days=max_age)).isoformat()]
        r = self.db.execute(sql + " ORDER BY obs_date DESC LIMIT 1", args).fetchone()
        return None if not r else {"value": r[1], "date": r[0], "dataset": r[2]}

    def normals(self, place: str) -> dict:
        rows = self.db.execute("SELECT month, param, value, elevation_m FROM normals WHERE place=?", (place,)).fetchall()
        out = {"elevation_m": rows[0][3] if rows else None}
        for m, p, v, _ in rows:
            out.setdefault(p, {})[m] = v
        return out


def rain_window(q: Q, place: str, normals: dict, days: int = 30) -> dict | None:
    s = q.series(place, "precip_mm")
    if not s:
        return None
    end = date.fromisoformat(s[-1][0])
    start = end - timedelta(days=days - 1)
    win = [x for x in s if x[0] >= start.isoformat()]
    if len(win) < days * 0.8:
        return {"available": False, "reason": f"only {len(win)} of {days} days stored"}
    total = sum(x[1] for x in win)
    normal = None
    if normals.get("PRECTOTCORR"):
        normal, d = 0.0, start
        while d <= end:
            normal += normals["PRECTOTCORR"].get(d.month) or 0
            d += timedelta(days=1)
    return {"available": True, "start": start.isoformat(), "end": end.isoformat(), "total_mm": _r(total, 1),
            "heavy_rain_days_50mm": sum(1 for x in win if x[1] >= 50), "wettest_day_mm": _r(max(x[1] for x in win), 1),
            "normal_mm": _r(normal, 1), "anomaly_pct": _r((total - normal) / normal * 100, 1) if normal else None,
            "sources": sorted({x[2] for x in win})}


def ndvi_status(q: Q, place: str) -> dict | None:
    cur = q.latest(place, "ndvi", MAX_AGE["ndvi"])
    if not cur:
        return None
    d = date.fromisoformat(cur["date"])
    hist = []
    for y in range(1, 11):
        c = d.replace(year=d.year - y, day=min(d.day, 28))
        vals = [x[1] for x in q.series(place, "ndvi", c - timedelta(days=16), c + timedelta(days=16))]
        if vals:
            hist.append(statistics.mean(vals))
    out = {"ndvi": _r(cur["value"], 3), "date": cur["date"], "baseline_years": len(hist)}
    if len(hist) >= 2:
        out["normal"] = _r(statistics.mean(hist), 3)
        out["anomaly"] = _r(cur["value"] - out["normal"], 3)
    return out


def et_status(q: Q, place: str) -> dict | None:
    cur = q.latest(place, "et_daily", MAX_AGE["et_daily"])
    if not cur:
        return None
    hist = [x[1] for x in q.series(place, "et_daily")]
    rel = None
    if len(hist) >= 8:
        p90 = statistics.quantiles(hist, n=10)[-1] or 1
        rel = _r(min(cur["value"] / p90, 1.0), 3)
    return {"et": _r(cur["value"], 3), "date": cur["date"], "relative_to_usual_high": rel}


def _clamp(v):
    return max(0.0, min(100.0, v))


def crop_condition(ndvi: dict | None, smap: dict | None, rain: dict | None, lst: dict | None, et: dict | None) -> dict:
    comps = {}
    if ndvi and ndvi.get("anomaly") is not None:
        comps["vegetation"] = _clamp(50 + ndvi["anomaly"] * 250)
    if smap:
        w = smap["value"]
        comps["soil_water"] = 80.0 if w >= 0.9 else _clamp((w - 0.15) / 0.30 * 100)
    if rain and rain.get("anomaly_pct") is not None:
        a = rain["anomaly_pct"]
        comps["rainfall"] = _clamp(100 + a * 2) if a < 0 else _clamp(100 - max(0.0, a - 50))
    hw = []
    if lst:
        hw.append(_clamp((45 - lst["value"]) / 15 * 100))
    if et and et.get("relative_to_usual_high") is not None:
        hw.append(_clamp(et["relative_to_usual_high"] * 100))
    if hw:
        comps["heat_water"] = sum(hw) / len(hw)
    if not comps:
        return {"score": None, "level": "unknown", "components": {}, "weights_used": {}, "missing": list(CONDITION_WEIGHTS)}
    tw = sum(CONDITION_WEIGHTS[k] for k in comps)
    score = sum(v * CONDITION_WEIGHTS[k] for k, v in comps.items()) / tw
    return {"score": _r(score, 1), "level": "good" if score >= 70 else "fair" if score >= 45 else "poor",
            "components": {k: _r(v, 1) for k, v in comps.items()}, "weights_used": {k: _r(CONDITION_WEIGHTS[k] / tw, 3) for k in comps},
            "missing": [k for k in CONDITION_WEIGHTS if k not in comps]}


def district(q: Q, name: str) -> dict:
    meta = districts.info()[name]
    nm = q.normals(name)
    today = date.today()
    recent = {m: q.series(name, m, today - timedelta(days=40)) for m in ("t2m", "t2m_max", "rh2m", "power_precip_mm", "solar_kwh_m2", "wind_ms")}
    power_recent = None
    if recent["t2m"]:
        last30 = lambda m: [x[1] for x in recent[m]][-30:]
        power_recent = {"days": len(last30("t2m")), "end": recent["t2m"][-1][0], "mean_temp_c": _r(statistics.mean(last30("t2m")), 1),
                        "max_temp_c": _r(max(last30("t2m_max")), 1) if last30("t2m_max") else None,
                        "rain_mm": _r(sum(last30("power_precip_mm")), 1) if last30("power_precip_mm") else None,
                        "humidity_pct": _r(statistics.mean(last30("rh2m")), 1) if last30("rh2m") else None,
                        "solar_kwh_m2": _r(statistics.mean(last30("solar_kwh_m2")), 2) if last30("solar_kwh_m2") else None,
                        "wind_ms": _r(statistics.mean(last30("wind_ms")), 2) if last30("wind_ms") else None}
    seasons = {}
    if nm.get("T2M"):
        for s, months in SEASONS.items():
            t = [nm["T2M"].get(m) for m in months if nm["T2M"].get(m) is not None]
            seasons[s] = {"mean_temp_c": _r(statistics.mean(t), 1) if t else None,
                          "rainfall_mm": _r(sum((nm["PRECTOTCORR"].get(m) or 0) * DAYS_IN_MONTH[m - 1] for m in months), 0)}
    rain = rain_window(q, name, nm)
    smap = q.latest(name, "smap_rootzone_wetness", MAX_AGE["smap_rootzone_wetness"])
    smap_s = q.latest(name, "smap_surface_sm", MAX_AGE["smap_surface_sm"])
    merra = q.latest(name, "merra2_rootzone_wetness", 20)
    ndvi = ndvi_status(q, name)
    lst = q.latest(name, "lst_c", MAX_AGE["lst_c"])
    et = et_status(q, name)
    srtm = {k: _r((q.latest(name, k) or {}).get("value"), 1) for k in ("elevation_mean", "elevation_std", "elevation_max", "elevation_min")}
    wet = smap or merra
    return {
        "name": name, "code": meta["code"], "province": meta["province"], "lat": meta["lat"], "lon": meta["lon"],
        "nasa_power": {"last_30_days": power_recent, "season_normals_2001_2020": seasons, "grid_elevation_m": nm.get("elevation_m")},
        "gpm_imerg": {"rain_30_days": rain},
        "smap": {"root_zone_wetness": _r(smap["value"], 3) if smap else None, "root_zone_date": smap["date"] if smap else None,
                 "surface_soil_moisture_m3m3": _r(smap_s["value"], 3) if smap_s else None,
                 "water_stress": None if not wet else ("high" if wet["value"] < 0.25 else "moderate" if wet["value"] < 0.4 else "low"),
                 "fallback_merra2_root_zone": _r(merra["value"], 3) if (merra and not smap) else None},
        "modis": {"ndvi": ndvi},
        "ecostress": {"surface_temp_c": _r(lst["value"], 1) if lst else None, "surface_temp_date": lst["date"] if lst else None,
                      "heat_stress": None if not lst else ("high" if lst["value"] >= 42 else "medium" if lst["value"] >= 35 else "low"),
                      "evapotranspiration": et},
        "srtm": srtm,
        "crop_suitability_inputs": {
            "rainfall_normal_mm": seasons, "soil_moisture_root": _r(wet["value"], 3) if wet else None,
            "soil_moisture_source": "SMAP L4" if smap else "MERRA-2 (NASA POWER)" if merra else None,
            "elevation_m": srtm["elevation_mean"] if srtm["elevation_mean"] is not None else nm.get("elevation_m"),
            "elevation_source": "SRTM" if srtm["elevation_mean"] is not None else "NASA POWER grid" if nm.get("elevation_m") else None,
            "terrain_std_m": srtm["elevation_std"]},
        "crop_condition": crop_condition(ndvi, smap, rain, lst, et),
    }


def sources(db) -> dict:
    runs = {r["dataset"]: dict(r) for r in db.execute("SELECT * FROM runs")}
    out = {}
    for k, d in DATASETS.items():
        cnt = db.execute("SELECT COUNT(*), MAX(obs_date) FROM observations WHERE dataset=?", (k,)).fetchone()
        r = runs.get(k, {})
        out[k] = {"title": d.title, "mission": d.mission, "resolution": d.resolution, "cadence": d.cadence, "needs": d.credentials,
                  "values_stored": cnt[0], "latest_observation": cnt[1], "last_success_at": r.get("last_success_at"),
                  "last_error": r.get("last_error"), "status": "loaded" if cnt[0] else ("error" if r.get("last_error") else "not loaded")}
    return out


def build(db) -> dict:
    q = Q(db)
    farms = {}
    for (place,) in db.execute("SELECT DISTINCT place FROM observations WHERE dataset='landsat_ndvi'"):
        s = q.series(place, "ndvi")
        farms[place.removeprefix("farm:")] = {"latest_ndvi": _r(s[-1][1], 3), "date": s[-1][0], "series": [{"date": d, "ndvi": _r(v, 3)} for d, v, _ in s[-24:]]}
    return {"generated_at": store.now(), "kit_version": __version__, "country": "Sri Lanka",
            "attribution": "NASA POWER (LaRC), GPM IMERG (GES DISC), SMAP (NSIDC), MODIS/Landsat HLS/ECOSTRESS/SRTM (LP DAAC via AppEEARS). "
                           "District boundaries: Dept. of Census & Statistics / HDX via lk_admin_regions (MIT).",
            "weights": {"crop_suitability": SUITABILITY_WEIGHTS, "crop_condition": CONDITION_WEIGHTS},
            "sources": sources(db), "districts": {n: district(q, n) for n in districts.names()}, "farms": farms}


def write(db, out_dir: str) -> dict:
    os.makedirs(out_dir, exist_ok=True)
    data = build(db)
    jpath = os.path.join(out_dir, "sri_lanka_nasa.json")
    with open(jpath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    cpath = os.path.join(out_dir, "sri_lanka_nasa_observations.csv")
    with open(cpath, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["dataset", "place", "date", "metric", "value", "units"])
        for r in db.execute("SELECT dataset, place, obs_date, metric, value, units FROM observations ORDER BY dataset, place, obs_date, metric"):
            w.writerow(list(r))
    return {"json": jpath, "csv": cpath, "districts": len(data["districts"]), "farms": len(data["farms"])}
