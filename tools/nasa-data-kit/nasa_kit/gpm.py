"""GPM IMERG daily rainfall (NASA GES DISC). Needs EARTHDATA_TOKEN. District mean over 0.1° cells inside each polygon."""
import io
from datetime import date, datetime, timedelta

import h5py
import numpy as np

from . import districts, store
from .catalog import DATASETS
from .config import settings
from .http import UpstreamError, client, get_json, request

SL = {"lat": (5.6, 10.1), "lon": (79.3, 82.2)}
LATENCY = {"gpm_imerg_late": 2, "gpm_imerg_final": 120}


def search(dataset: str, start: date, end: date, page_size: int = 100) -> list[dict]:
    short, version = DATASETS[dataset].products
    data = get_json("NASA CMR", f"{settings().cmr_url}/granules.json", params={
        "short_name": short, "version": version, "bounding_box": "79.4,5.7,82.1,10.0", "page_size": page_size, "sort_key": "-start_date",
        "temporal": f"{start.isoformat()}T00:00:00Z,{end.isoformat()}T23:59:59Z"})
    out = []
    for e in data.get("feed", {}).get("entry", []):
        url = next((l["href"] for l in e.get("links", []) if l.get("rel", "").endswith("/data#") and l.get("href", "").startswith("http")), None)
        if url:
            out.append({"id": e.get("producer_granule_id") or e.get("title"), "date": datetime.fromisoformat(e["time_start"].replace("Z", "+00:00")).date(), "url": url})
    return out


def download(url: str, c=None) -> bytes:
    token = settings().earthdata_token
    if not token:
        raise UpstreamError("GES DISC", "EARTHDATA_TOKEN is not set")
    r = request("GET", "GES DISC", url, c, headers={"Authorization": f"Bearer {token}"})
    if r.status_code != 200 or r.content[:4] != b"\x89HDF":
        raise UpstreamError("GES DISC", f"download failed (HTTP {r.status_code}). Check the token and approve 'NASA GESDISC DATA ARCHIVE' "
                                        "under Applications in your Earthdata profile.", r.status_code)
    return r.content


def _find(f, name):
    hits = []
    f.visititems(lambda n, o: hits.append(o) if isinstance(o, h5py.Dataset) and n.split("/")[-1] == name else None)
    if not hits:
        raise UpstreamError("GES DISC", f"'{name}' not found in IMERG file")
    return hits[0]


def district_means(nc: bytes) -> dict[str, dict]:
    with h5py.File(io.BytesIO(nc), "r") as f:
        lat, lon = _find(f, "lat")[:].astype(float), _find(f, "lon")[:].astype(float)
        pv = _find(f, "precipitation")
        shp = pv.shape
        lat_ax = next(i for i, n in enumerate(shp) if n == lat.size)
        lon_ax = next(i for i, n in enumerate(shp) if n == lon.size and i != lat_ax)
        il = np.nonzero((lat >= SL["lat"][0]) & (lat <= SL["lat"][1]))[0]
        jl = np.nonzero((lon >= SL["lon"][0]) & (lon <= SL["lon"][1]))[0]
        sel = [0] * len(shp)
        sel[lat_ax], sel[lon_ax] = slice(int(il[0]), int(il[-1]) + 1), slice(int(jl[0]), int(jl[-1]) + 1)
        sub = np.asarray(pv[tuple(sel)], dtype=float)
        if lat_ax > lon_ax:
            sub = sub.T
    sub[sub < 0] = np.nan  # fill value -9999.9 and any negatives
    out = {}
    for name, (li, lj) in districts.grid_masks(lat[il], lon[jl]).items():
        v = sub[li, lj]
        v = v[~np.isnan(v)]
        if v.size:
            out[name] = {"mean": round(float(v.mean()), 3), "max": round(float(v.max()), 3), "cells": int(v.size)}
    return out


def fetch(db, dataset: str = "gpm_imerg_late", days: int = 30, start: date | None = None, end: date | None = None) -> dict:
    end = end or date.today() - timedelta(days=LATENCY[dataset])
    start = start or end - timedelta(days=days - 1)
    granules = search(dataset, start, end, page_size=max(10, (end - start).days + 5))
    done, errors = 0, []
    with client() as c:
        c.timeout = 300
        for g in granules:
            try:
                means = district_means(download(g["url"], c))
                store.upsert(db, [{"dataset": dataset, "place": k, "date": g["date"], "metric": "precip_mm", "value": v["mean"], "units": "mm/day",
                                   "extra": {"max": v["max"], "cells": v["cells"], "granule": g["id"]}} for k, v in means.items()])
                done += 1
            except UpstreamError as e:
                errors.append(f"{g['id']}: {e}")
                if e.status in (401, 403) or "token" in str(e).lower():
                    break
    store.mark(db, dataset, done > 0, errors[0] if errors and not done else None)
    if errors and not done:
        raise UpstreamError("GES DISC", errors[0])
    return {"dataset": dataset, "granules": len(granules), "days_stored": done, "errors": errors[:5]}
