"""NASA Earthdata discovery via the Common Metadata Repository (CMR).

Granule *discovery* is public. *Downloading* GPM IMERG / SMAP files needs an Earthdata Login
bearer token (EARTHDATA_TOKEN, server-side only). Raster processing of downloaded HDF5 files
into district statistics is the next implementation step (services/geospatial-processing).
"""
from datetime import date

import httpx
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import SatelliteObservation
from app.services.http import get_json

PRODUCTS = {
    "gpm_imerg_final": {"short_name": "GPM_3IMERGDF", "version": "07"},
    "smap_l3_enhanced": {"short_name": "SPL3SMP_E", "version": None},
    "smap_l4_rootzone": {"short_name": "SPL4SMGP", "version": None},
}
SL_BBOX = "79.4,5.7,82.1,10.0"  # lon_min,lat_min,lon_max,lat_max (CMR order)


def search_granules(source_key: str, start: date, end: date, page_size: int = 50,
                    client: httpx.Client | None = None) -> list[dict]:
    if source_key not in PRODUCTS:
        raise ValueError(f"unknown product {source_key}")
    p = PRODUCTS[source_key]
    params = {"short_name": p["short_name"], "bounding_box": SL_BBOX, "page_size": page_size,
              "temporal": f"{start.isoformat()}T00:00:00Z,{end.isoformat()}T23:59:59Z", "sort_key": "-start_date"}
    if p["version"]:
        params["version"] = p["version"]
    data = get_json("NASA CMR", f"{get_settings().NASA_CMR_BASE_URL}/granules.json", params=params, client=client)
    out = []
    for e in data.get("feed", {}).get("entry", []):
        link = next((l["href"] for l in e.get("links", []) if l.get("rel", "").endswith("/data#") and l.get("href", "").startswith("http")), None)
        out.append({"granule_id": e.get("producer_granule_id") or e.get("title"), "time_start": e.get("time_start"),
                    "time_end": e.get("time_end"), "download_url": link, "size_mb": e.get("granule_size")})
    return out


def store_granules(db: Session, source_key: str, granules: list[dict]) -> int:
    if not granules:
        return 0
    stmt = pg_insert(SatelliteObservation).values([
        {"source_key": source_key, "granule_id": g["granule_id"], "time_start": g["time_start"], "time_end": g["time_end"],
         "download_url": g["download_url"], "meta": {"size_mb": g.get("size_mb")}} for g in granules
    ]).on_conflict_do_nothing(index_elements=["source_key", "granule_id"])
    res = db.execute(stmt)
    db.commit()
    return res.rowcount or 0
