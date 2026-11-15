"""Official Sri Lanka district polygons (Dept. of Census & Statistics / HDX via lk_admin_regions, MIT; simplified)."""
import json
from functools import lru_cache
from pathlib import Path

import numpy as np
import shapely
from shapely.geometry import shape

PROVINCES = {"LK-1": "Western", "LK-2": "Central", "LK-3": "Southern", "LK-4": "Northern", "LK-5": "Eastern",
             "LK-6": "North Western", "LK-7": "North Central", "LK-8": "Uva", "LK-9": "Sabaragamuwa"}


@lru_cache
def features() -> list[dict]:
    return json.loads((Path(__file__).parent / "districts.geojson").read_text(encoding="utf-8"))["features"]


@lru_cache
def info() -> dict[str, dict]:
    """name → {code, province, lat, lon}. lat/lon is a point guaranteed inside the polygon (for NASA POWER)."""
    out = {}
    for f in features():
        p = shape(f["geometry"]).representative_point()
        out[f["properties"]["name"]] = {"code": f["properties"]["code"], "province": PROVINCES[f["properties"]["province_code"]],
                                        "lat": round(p.y, 3), "lon": round(p.x, 3)}
    return out


def names() -> list[str]:
    return [f["properties"]["name"] for f in features()]


def area_features() -> list[dict]:
    """GeoJSON features (submission order = AppEEARS aid0001, aid0002, …)."""
    return [{"type": "Feature", "properties": {"name": f["properties"]["name"]}, "geometry": f["geometry"]} for f in features()]


@lru_cache
def _shapes():
    return [(f["properties"]["name"], shape(f["geometry"])) for f in features()]


def grid_masks(lats: np.ndarray, lons: np.ndarray) -> dict[str, tuple[np.ndarray, np.ndarray]]:
    """Cells of a regular lat/lon grid whose centre lies in each district (nearest cell for tiny districts)."""
    lon2, lat2 = np.meshgrid(lons, lats)
    out = {}
    for name, geom in _shapes():
        li, lj = np.nonzero(shapely.contains_xy(geom, lon2, lat2))
        if li.size == 0:
            c = geom.centroid
            li, lj = np.array([int(np.abs(lats - c.y).argmin())]), np.array([int(np.abs(lons - c.x).argmin())])
        out[name] = (li, lj)
    return out
