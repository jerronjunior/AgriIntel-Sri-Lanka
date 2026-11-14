import json
from datetime import date
from pathlib import Path

import httpx
import pytest
import respx

from app.services import nasa_power
from app.services.http import UpstreamError

FIX = Path(__file__).parent / "fixtures"
DAILY = json.loads((FIX / "power_daily.json").read_text())
CLIM = json.loads((FIX / "power_climatology.json").read_text())


def test_parse_daily_maps_fill_values_to_none():
    d = nasa_power.parse_daily(DAILY, nasa_power.DAILY_PARAMS)
    assert len(d.rows) == 10
    assert d.elevation_m == 128.4
    assert d.rows[5]["precip_mm"] is None and d.rows[5]["solar_kwh_m2"] is None
    assert d.rows[3]["precip_mm"] == 60.0
    assert d.rows[0]["obs_date"] == date(2024, 1, 1)


def test_parse_daily_rejects_bad_shape():
    with pytest.raises(UpstreamError):
        nasa_power.parse_daily({"unexpected": True}, nasa_power.DAILY_PARAMS)


def test_seasonal_climate_from_climatology():
    with respx.mock(base_url="https://power.larc.nasa.gov/api") as m:
        route = m.get("/temporal/climatology/point").mock(return_value=httpx.Response(200, json=CLIM))
        clim = nasa_power.fetch_climatology(6.87, 81.35)
        assert route.called
        q = route.calls[0].request.url.params
        assert q["community"] == "AG" and "PRECTOTCORR" in q["parameters"]
    sc = nasa_power.seasonal_climate(clim, [4, 5, 6, 7, 8])
    assert sc["elevation_m"] == 128.4
    assert sc["rainfall_mm"] == pytest.approx(5.0 * 30 + 2.7 * 31 + 0.9 * 30 + 1.0 * 31 + 1.2 * 31, rel=1e-3)
    assert sc["mean_temp_c"] == pytest.approx((28.6 + 28.9 + 28.6 + 28.4 + 28.4) / 5, rel=1e-3)


def test_retries_then_succeeds_on_503():
    with respx.mock(base_url="https://power.larc.nasa.gov/api") as m:
        route = m.get("/temporal/daily/point").mock(side_effect=[
            httpx.Response(503, headers={"Retry-After": "0.01"}), httpx.Response(200, json=DAILY)])
        d = nasa_power.fetch_daily(6.87, 81.35, date(2024, 1, 1), date(2024, 1, 10))
        assert route.call_count == 2 and len(d.rows) == 10


def test_persistent_failure_raises():
    with respx.mock(base_url="https://power.larc.nasa.gov/api") as m:
        m.get("/temporal/daily/point").mock(return_value=httpx.Response(500, text="boom", headers={"Retry-After": "0.01"}))
        with pytest.raises(UpstreamError):
            nasa_power.fetch_daily(6.87, 81.35, date(2024, 1, 1), date(2024, 1, 2))


def test_rejects_points_outside_sri_lanka():
    with pytest.raises(ValueError):
        nasa_power.fetch_daily(51.5, -0.1, date(2024, 1, 1), date(2024, 1, 2))
