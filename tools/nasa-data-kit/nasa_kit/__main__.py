"""Command line:  python -m nasa_kit <command>

  status                       what's loaded, what's missing, which credentials are set
  power   [--days 90]          NASA POWER daily weather + soil wetness, and 2001–2020 normals (no account needed)
  gpm     [--days 30] [--final] GPM IMERG daily rainfall (needs EARTHDATA_TOKEN)
  submit  [--datasets ...] [--start YYYY-MM-DD --end YYYY-MM-DD] [--farms farms.geojson] [--ndvi-years N]
                               send AppEEARS requests: SMAP, MODIS, Landsat, ECOSTRESS, SRTM (needs EARTHDATA_USERNAME/PASSWORD)
  collect [--wait MINUTES]     download finished AppEEARS results (NASA queues requests: minutes to hours)
  export                       write output/sri_lanka_nasa.json and output/sri_lanka_nasa_observations.csv
  all     [--wait MINUTES] [--farms farms.geojson]   power → gpm → submit → collect → export
  serve   [--port 8090]        small JSON API for websites (reads the local store)
"""
import argparse
import json
import sys
import time
from datetime import date, timedelta

from . import appeears, export, gpm, power, store
from .catalog import APPEEARS
from .config import settings
from .http import UpstreamError


def _print(obj):
    print(json.dumps(obj, indent=2, default=str, ensure_ascii=False))


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="python -m nasa_kit", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("status")
    p = sub.add_parser("power"); p.add_argument("--days", type=int, default=90)
    p = sub.add_parser("gpm"); p.add_argument("--days", type=int, default=30); p.add_argument("--final", action="store_true")
    p = sub.add_parser("submit")
    p.add_argument("--datasets", nargs="*", choices=[d.key for d in APPEEARS])
    p.add_argument("--start"); p.add_argument("--end"); p.add_argument("--farms")
    p.add_argument("--ndvi-years", type=int, default=0, help="also request N years of MODIS NDVI history (needed for 'vs normal')")
    p = sub.add_parser("collect"); p.add_argument("--wait", type=int, default=0, help="keep polling for up to N minutes")
    sub.add_parser("export")
    p = sub.add_parser("all"); p.add_argument("--wait", type=int, default=60); p.add_argument("--farms"); p.add_argument("--ndvi-years", type=int, default=4)
    p = sub.add_parser("serve"); p.add_argument("--port", type=int, default=8090); p.add_argument("--host", default="127.0.0.1")
    a = ap.parse_args(argv)
    s = settings()
    db = store.connect(s.db_path)

    def do_collect(wait_min: int):
        deadline = time.time() + wait_min * 60
        while True:
            r = appeears.collect(db)
            print(f"  collect: {r}")
            if r["running"] == 0 or time.time() >= deadline:
                return r
            time.sleep(min(120, max(5, deadline - time.time())))

    def do_submit(datasets, start, end, farms, ndvi_years):
        s_ = date.fromisoformat(start) if start else None
        e_ = date.fromisoformat(end) if end else None
        r = appeears.submit(db, datasets, s_, e_, farms)
        if ndvi_years:
            hist = appeears.submit(db, ["modis_ndvi"], date(date.today().year - ndvi_years, 1, 1), date.today() - timedelta(days=3))
            r["submitted"] += hist["submitted"]; r["errors"] += hist["errors"]
        return r

    try:
        if a.cmd == "status":
            data = export.sources(db)
            creds = {"EARTHDATA_USERNAME/PASSWORD (AppEEARS)": bool(s.earthdata_username and s.earthdata_password),
                     "EARTHDATA_TOKEN (GPM IMERG)": bool(s.earthdata_token)}
            pending = db.execute("SELECT dataset, COUNT(*) FROM tasks WHERE status='submitted' GROUP BY dataset").fetchall()
            _print({"credentials_set": creds, "datasets": data, "appeears_requests_waiting": dict(pending)})
        elif a.cmd == "power":
            end = date.today() - timedelta(days=5)
            _print({"daily": power.fetch_daily(db, end - timedelta(days=a.days - 1), end), "normals": power.fetch_normals(db)})
        elif a.cmd == "gpm":
            _print(gpm.fetch(db, "gpm_imerg_final" if a.final else "gpm_imerg_late", a.days))
        elif a.cmd == "submit":
            _print(do_submit(a.datasets, a.start, a.end, a.farms, a.ndvi_years))
        elif a.cmd == "collect":
            _print(do_collect(a.wait))
        elif a.cmd == "export":
            _print(export.write(db, s.output_dir))
        elif a.cmd == "all":
            steps = []
            print("1/5 NASA POWER"); end = date.today() - timedelta(days=5)
            steps.append(("power", lambda: {"daily": power.fetch_daily(db, end - timedelta(days=89), end), "normals": power.fetch_normals(db)}))
            for name, fn in [steps[0], ("gpm", lambda: gpm.fetch(db, "gpm_imerg_late", 35)),
                             ("submit", lambda: do_submit(None, None, None, a.farms, a.ndvi_years)), ("collect", lambda: do_collect(a.wait))]:
                if name != "power":
                    print({"gpm": "2/5 GPM IMERG", "submit": "3/5 AppEEARS submit", "collect": f"4/5 AppEEARS collect (waiting up to {a.wait} min)"}[name])
                try:
                    r = fn()
                    print(f"  {name}: ok")
                except UpstreamError as e:
                    print(f"  {name}: skipped — {e}")
            print("5/5 export")
            _print(export.write(db, s.output_dir))
        elif a.cmd == "serve":
            from .api import serve
            serve(a.host, a.port)
    except UpstreamError as e:
        print(f"ERROR {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
