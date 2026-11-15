"""NASA AppEEARS — MODIS NDVI, Landsat (HLS) NDVI, ECOSTRESS LST/ET, SMAP L3/L4, SRTM.

Area requests with the 25 district polygons (or your farm boundaries); NASA computes the per-polygon statistics and we
download only the small *-Statistics.csv files. Requests are queued at NASA, so this is two steps:
    submit()  → send requests (returns immediately)
    collect() → later, download finished results
Needs EARTHDATA_USERNAME / EARTHDATA_PASSWORD.
"""
from __future__ import annotations

import csv
import io
import json
import re
import statistics
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from . import districts, store
from .catalog import APPEEARS, DATASETS, Dataset
from .config import settings
from .http import UpstreamError, client, get_json, request

AID = re.compile(r"aid0*(\d+)", re.I)
WINDOWS = {"modis_ndvi": 48, "ecostress_lst": 16, "ecostress_et": 16, "smap_l4_rootzone": 10, "smap_l3_surface": 10, "landsat_ndvi": 32}


@dataclass
class Layer:
    product: str
    layer: str
    units: str | None
    scale: float | None


class Client:
    def __init__(self):
        s = settings()
        self.base, self.user, self.pw = s.appeears_url, s.earthdata_username, s.earthdata_password
        self.http = client()
        self.http.timeout = 240
        self._token = None
        self._products = None
        self._layers: dict[str, dict] = {}

    def auth(self) -> dict:
        if not self._token:
            if not (self.user and self.pw):
                raise UpstreamError("AppEEARS", "EARTHDATA_USERNAME / EARTHDATA_PASSWORD are not set")
            r = request("POST", "AppEEARS", f"{self.base}/login", self.http, auth=(self.user, self.pw))
            if r.status_code != 200:
                raise UpstreamError("AppEEARS", f"login failed (HTTP {r.status_code}): {r.text[:200]}", r.status_code)
            self._token = r.json()["token"]
        return {"Authorization": f"Bearer {self._token}"}

    def resolve(self, ds: Dataset) -> Layer:
        if self._products is None:
            self._products = {p["ProductAndVersion"] for p in get_json("AppEEARS", f"{self.base}/product", self.http)}
        for prod in ds.products:
            if prod not in self._products:
                continue
            if prod not in self._layers:
                self._layers[prod] = get_json("AppEEARS", f"{self.base}/product/{prod}", self.http)
            for pat in ds.layers:
                for name, meta in self._layers[prod].items():
                    if name.lower().endswith(pat.lower()):
                        sf = meta.get("ScaleFactor")
                        return Layer(prod, name, meta.get("Units"), float(sf) if sf not in (None, "", "N/A") else None)
        raise UpstreamError("AppEEARS", f"no available product/layer for {ds.key}; tried {ds.products}")

    def submit(self, name: str, layer: Layer, start: date, end: date, feats: list[dict]) -> str:
        task = {"task_type": "area", "task_name": name[:100], "params": {
            "dates": [{"startDate": start.strftime("%m-%d-%Y"), "endDate": end.strftime("%m-%d-%Y")}],
            "layers": [{"product": layer.product, "layer": layer.layer}],
            "output": {"format": {"type": "geotiff"}, "projection": "geographic"},
            "geo": {"type": "FeatureCollection", "features": feats}}}
        r = request("POST", "AppEEARS", f"{self.base}/task", self.http, json=task, headers=self.auth())
        if r.status_code not in (200, 202):
            raise UpstreamError("AppEEARS", f"submit failed (HTTP {r.status_code}): {r.text[:300]}", r.status_code)
        return r.json()["task_id"]

    def status(self, task_id: str) -> str:
        return get_json("AppEEARS", f"{self.base}/task/{task_id}", self.http, headers=self.auth()).get("status", "unknown")

    def stats_files(self, task_id: str) -> list[dict]:
        files = get_json("AppEEARS", f"{self.base}/bundle/{task_id}", self.http, headers=self.auth()).get("files", [])
        return [f for f in files if f["file_name"].split("/")[-1].endswith("-Statistics.csv") and "QA" not in f["file_name"] and "QC" not in f["file_name"]]

    def download(self, task_id: str, file_id: str) -> str:
        r = request("GET", "AppEEARS", f"{self.base}/bundle/{task_id}/{file_id}", self.http, headers=self.auth())
        if r.status_code >= 400:
            raise UpstreamError("AppEEARS", f"download failed (HTTP {r.status_code})", r.status_code)
        return r.text


# ------------------------------------------------------------------ parsing
def parse_stats(text: str, keys: list[str]) -> list[dict]:
    reader = csv.DictReader(io.StringIO(text))
    cols = {c.lower().strip(): c for c in (reader.fieldnames or [])}
    out = []
    for row in reader:
        m = AID.search(row.get(cols.get("aid", ""), "") or row.get(cols.get("file name", ""), "") or "")
        if not m or not (1 <= int(m.group(1)) <= len(keys)):
            continue
        try:
            d = datetime.strptime(row[cols["date"]][:10], "%Y-%m-%d").date()
        except (KeyError, ValueError):
            continue
        st = {}
        for k in ("Count", "Mean", "Standard Deviation", "Minimum", "Maximum"):
            try:
                st[k] = float(row[cols[k.lower()]])
            except (KeyError, ValueError, TypeError):
                pass
        out.append({"key": keys[int(m.group(1)) - 1], "date": d, "stats": st})
    return out


def normalise(v: float | None, ds: Dataset, scale: float | None) -> float | None:
    """Apply scale factor / Kelvin→°C only when needed to reach the plausible range; otherwise drop the value."""
    if v is None:
        return None
    raw = [v] + ([v * scale] if scale and scale not in (0, 1) else [])
    cands = [x - 273.15 for x in raw] + raw if ds.kelvin_to_c else raw
    lo, hi = ds.valid
    return next((round(c, 4) for c in cands if lo <= c <= hi), None)


# ------------------------------------------------------------------ workflow
def submit(db, keys: list[str] | None = None, start: date | None = None, end: date | None = None, farms_path: str | None = None) -> dict:
    c = Client()
    out, errors = [], []
    for ds in [DATASETS[k] for k in keys] if keys else APPEEARS:
        if ds.scope == "farms" and not farms_path:
            continue
        if ds.static:
            s_, e_ = date(2000, 2, 11), date(2000, 2, 22)
        elif start and end:
            s_, e_ = start, end
        else:
            e_ = date.today() - timedelta(days=3)
            s_ = e_ - timedelta(days=WINDOWS.get(ds.key, 16))
        if ds.scope == "farms":
            fc = json.loads(open(farms_path, encoding="utf-8").read())
            feats = [{"type": "Feature", "properties": {"name": str((f.get("properties") or {}).get("name") or f"farm-{i + 1}")}, "geometry": f["geometry"]}
                     for i, f in enumerate(fc["features"]) if f.get("geometry", {}).get("type") in ("Polygon", "MultiPolygon")]
            keys_ = [f"farm:{f['properties']['name']}" for f in feats]
        else:
            feats, keys_ = districts.area_features(), districts.names()
        scope = "farms" if ds.scope == "farms" else "districts"
        dup = db.execute("SELECT task_id FROM tasks WHERE dataset=? AND scope=? AND window_start=? AND window_end=? AND status!='error'",
                         (ds.key, scope, s_.isoformat(), e_.isoformat())).fetchone()
        if dup:
            out.append({"dataset": ds.key, "task_id": dup[0], "note": "already submitted"})
            continue
        try:
            layer = c.resolve(ds)
            tid = c.submit(f"nasa-kit-{ds.key}-{s_:%Y%m%d}-{e_:%Y%m%d}", layer, s_, e_, feats)
            db.execute("INSERT INTO tasks (task_id, dataset, scope, window_start, window_end, product, layer, keys, meta, status, created_at, updated_at) "
                       "VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", (tid, ds.key, scope, s_.isoformat(), e_.isoformat(), layer.product, layer.layer,
                                                          json.dumps(keys_), json.dumps({"units": layer.units, "scale": layer.scale}), "submitted",
                                                          store.now(), store.now()))
            db.commit()
            out.append({"dataset": ds.key, "task_id": tid, "product": layer.product, "layer": layer.layer, "window": [str(s_), str(e_)]})
        except UpstreamError as e:
            errors.append({"dataset": ds.key, "error": str(e)})
            store.mark(db, ds.key, False, str(e))
    return {"submitted": out, "errors": errors}


def collect(db) -> dict:
    c = Client()
    res = {"checked": 0, "stored": 0, "running": 0, "failed": 0, "rows": 0}
    for t in db.execute("SELECT * FROM tasks WHERE status='submitted' ORDER BY created_at").fetchall():
        res["checked"] += 1
        try:
            st = c.status(t["task_id"])
            if st in ("pending", "queued", "processing"):
                res["running"] += 1
                continue
            if st != "done":
                db.execute("UPDATE tasks SET status='error', error=?, updated_at=? WHERE task_id=?", (f"AppEEARS status {st}", store.now(), t["task_id"]))
                store.mark(db, t["dataset"], False, f"AppEEARS status {st}")
                res["failed"] += 1
                continue
            n = 0
            for f in c.stats_files(t["task_id"]):
                n += ingest(db, t, c.download(t["task_id"], f["file_id"]))
            db.execute("UPDATE tasks SET status='stored', rows=?, updated_at=? WHERE task_id=?", (n, store.now(), t["task_id"]))
            store.mark(db, t["dataset"], True)
            res["stored"] += 1
            res["rows"] += n
        except UpstreamError as e:
            db.execute("UPDATE tasks SET error=?, updated_at=? WHERE task_id=?", (str(e)[:1000], store.now(), t["task_id"]))
        db.commit()
    return res


def ingest(db, task, text: str) -> int:
    ds = DATASETS[task["dataset"]]
    scale = json.loads(task["meta"] or "{}").get("scale")
    units = ds.unit or json.loads(task["meta"] or "{}").get("units") or ""
    groups = defaultdict(list)
    for r in parse_stats(text, json.loads(task["keys"])):
        groups[(r["key"], r["date"])].append(r["stats"])  # SMAP L4 3-hourly / several ECOSTRESS passes → one daily value
    rows = []
    for (place, d), sts in groups.items():
        means = [m for m in (normalise(s.get("Mean"), ds, scale) for s in sts) if m is not None]
        if not means:
            continue
        rows.append({"dataset": ds.key, "place": place, "date": d, "metric": ds.metric, "value": round(statistics.mean(means), 4), "units": units,
                     "extra": {"pixels": int(sum(s.get("Count", 0) for s in sts)), "product": task["product"], "layer": task["layer"]}})
        for col, metric in ds.extra.items():
            vals = [s[col] for s in sts if col in s]
            if vals:
                v = statistics.mean(vals) if col == "Standard Deviation" else normalise(statistics.mean(vals), ds, scale)
                if v is not None:
                    rows.append({"dataset": ds.key, "place": place, "date": d, "metric": metric, "value": round(v, 3), "units": units})
    return store.upsert(db, rows) if rows else 0
