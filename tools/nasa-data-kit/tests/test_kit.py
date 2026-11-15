"""Offline tests. Fixtures follow NASA's documented response formats; nothing here contacts NASA."""
from datetime import date, timedelta

import pytest

from nasa_kit import appeears, districts, export, power, store
from nasa_kit.catalog import DATASETS


@pytest.fixture
def db(tmp_path):
    return store.connect(str(tmp_path / "t.sqlite"))


def test_25_districts_9_provinces():
    info = districts.info()
    assert len(info) == 25 and len({v["province"] for v in info.values()}) == 9
    assert 5.8 < info["Colombo"]["lat"] < 7.1 and 79.5 < info["Colombo"]["lon"] < 80.3


def test_power_parse_skips_fill_values():
    payload = {"properties": {"parameter": {"T2M": {"20261101": 27.1, "20261102": -999}, "PRECTOTCORR": {"20261101": 4.2, "20261102": 0.0}}}}
    rows = power.parse_daily(payload, "Galle")
    got = {(r["metric"], str(r["date"])): r["value"] for r in rows}
    assert got[("t2m", "2026-11-01")] == 27.1 and ("t2m", "2026-11-02") not in got
    assert got[("power_precip_mm", "2026-11-02")] == 0.0


@pytest.mark.parametrize("key,raw,scale,want", [
    ("modis_ndvi", 6123, 0.0001, 0.6123),    # MODIS integer with scale factor
    ("modis_ndvi", 0.61, 0.0001, 0.61),      # already scaled
    ("modis_ndvi", -5000, 0.0001, None),     # out of range → dropped, never invented
    ("ecostress_lst", 305.15, None, 32.0),   # Kelvin → °C
    ("ecostress_lst", 31.0, None, 31.0),
    ("smap_l4_rootzone", 0.42, None, 0.42),
])
def test_normalise(key, raw, scale, want):
    got = appeears.normalise(raw, DATASETS[key], scale)
    assert (got is None) if want is None else got == pytest.approx(want, abs=1e-3)


def test_parse_stats_maps_aid_to_polygon_order():
    csv = ("File Name,Dataset,aid,Date,Count,Minimum,Maximum,Range,Mean,Standard Deviation\n"
           "a.tif,NDVI,aid0002,2026-11-01,900,0.1,0.9,0.8,0.55,0.1\n"
           "a.tif,NDVI,aid0001,2026-11-01T00:00:00,800,0.1,0.9,0.8,0.61,0.1\n"
           "a.tif,NDVI,aid0099,2026-11-01,800,0.1,0.9,0.8,0.61,0.1\n")
    rows = appeears.parse_stats(csv, ["Ampara", "Anuradhapura"])
    assert {(r["key"], r["stats"]["Mean"]) for r in rows} == {("Anuradhapura", 0.55), ("Ampara", 0.61)}


def test_rain_window_prefers_final_and_needs_coverage(db):
    end = date.today() - timedelta(days=3)
    rows = [{"dataset": "gpm_imerg_late", "place": "Kandy", "date": end - timedelta(days=i), "metric": "precip_mm", "value": 2.0, "units": "mm/day"} for i in range(30)]
    rows.append({"dataset": "gpm_imerg_final", "place": "Kandy", "date": end, "metric": "precip_mm", "value": 32.0, "units": "mm/day"})
    store.upsert(db, rows)
    r = export.rain_window(export.Q(db), "Kandy", {})
    assert r["available"] and r["total_mm"] == 29 * 2 + 32 and r["anomaly_pct"] is None
    r2 = export.rain_window(export.Q(db), "Galle", {})
    assert r2 is None


def test_condition_reweights_when_data_missing():
    c = export.crop_condition(None, {"value": 0.30}, None, None, None)
    assert c["components"] == {"soil_water": 50.0} and c["weights_used"] == {"soil_water": 1.0}
    assert set(c["missing"]) == {"vegetation", "heat_water", "rainfall"}
    assert export.crop_condition(None, None, None, None, None)["score"] is None


def test_empty_store_exports_nulls_not_guesses(db, tmp_path):
    out = export.write(db, str(tmp_path / "o"))
    import json
    d = json.load(open(out["json"]))
    assert len(d["districts"]) == 25
    k = d["districts"]["Kandy"]
    assert k["modis"]["ndvi"] is None and k["srtm"]["elevation_mean"] is None and k["crop_condition"]["level"] == "unknown"
    assert all(s["status"] == "not loaded" for s in d["sources"].values())
