import pytest

from app.data.crops import CROPS
from app.services import crop_engine, profitability, risk, simulator


def test_trapezoid_bounds():
    assert crop_engine.trapezoid(25, 10, 20, 30, 40) == 100
    assert crop_engine.trapezoid(15, 10, 20, 30, 40) == 50
    assert crop_engine.trapezoid(35, 10, 20, 30, 40) == 50
    assert crop_engine.trapezoid(9, 10, 20, 30, 40) == 0
    assert crop_engine.trapezoid(41, 10, 20, 30, 40) == 0


def test_dry_season_favours_drought_tolerant_crops():
    res = crop_engine.recommend(CROPS, mean_temp_c=28.5, rainfall_mm=300, irrigation="none", elevation_m=120)
    scores = {r["crop"]: r["score"] for r in res["ranking"]}
    assert scores["green_gram"] > scores["paddy"]
    assert scores["sesame"] > scores["paddy"]
    assert "paddy" in res["avoid"]
    assert res["recommended"] in {"green_gram", "sesame", "cowpea"}
    assert "Not a validated AI prediction" in res["disclaimer"]


def test_wet_season_paddy_suitable_and_irrigation_helps():
    wet = crop_engine.score_crop("paddy", CROPS["paddy"], mean_temp_c=27, rainfall_mm=1400, irrigation="none")
    assert wet["class"] in ("highly suitable", "suitable")
    dry_none = crop_engine.score_crop("maize", CROPS["maize"], mean_temp_c=27, rainfall_mm=300, irrigation="none")
    dry_full = crop_engine.score_crop("maize", CROPS["maize"], mean_temp_c=27, rainfall_mm=300, irrigation="full")
    assert dry_full["score"] > dry_none["score"]
    assert dry_full["water_balance"]["deficit_mm"] == 0


def test_elevation_constraint_flagged():
    r = crop_engine.score_crop("sesame", CROPS["sesame"], mean_temp_c=27, rainfall_mm=400, elevation_m=1600)
    assert any("Elevation" in c for c in r["constraints"])


def test_profitability_formulas():
    out = profitability.compute(profitability.ProfitInputs(
        crop="green_gram", area_ha=2, yield_t_per_ha=1.0, price_lkr_per_kg=500,
        costs_per_ha=profitability.CostInputs(seed=20000, fertilizer=30000, labor=100000, irrigation=0, transport=10000, other=40000)))
    assert out["production_kg"] == 2000
    assert out["revenue_lkr"] == 1_000_000
    assert out["total_cost_lkr"] == 400_000
    assert out["net_profit_lkr"] == 600_000
    assert out["roi_pct"] == 150.0
    assert out["profit_per_ha_lkr"] == 300_000
    assert out["profit_per_acre_lkr"] == pytest.approx(300_000 * 0.404686, rel=1e-4)
    assert out["breakeven_price_lkr_per_kg"] == 200


def test_risk_components_and_missing_data():
    c = risk.climate_risk(-40)
    assert c["components"]["drought"] == 80
    m = risk.market_risk([100, 110])
    assert m["score"] is None and "Insufficient" in m["note"]
    o = risk.overall(c, risk.production_risk(60, 0.8), m)
    assert "market" in o["missing"] and o["score"] is not None
    assert "not a validated underwriting" in o["label"]


def test_simulator_rainfall_reduction_lowers_yield():
    base_in = dict(district="Monaragala", season="yala", area_ha=10, irrigation="none",
                   crops=[{"crop": c, "attainable_yield_t_per_ha": 1.2, "price_lkr_per_kg": 400} for c in ("green_gram", "sesame", "groundnut")],
                   baseline={"mean_temp_c": 28.5, "rainfall_mm": 450, "elevation_m": 130})
    a = simulator.run(simulator.SimulationInput(**base_in), CROPS, simulator.ClimateBaseline(**base_in["baseline"]))
    b = simulator.run(simulator.SimulationInput(**{**base_in, "rain_change_pct": -20}), CROPS, simulator.ClimateBaseline(**base_in["baseline"]))
    ya = {r["crop"]: r["yield"]["expected_t_per_ha"] for r in a["results"]}
    yb = {r["crop"]: r["yield"]["expected_t_per_ha"] for r in b["results"]}
    assert all(yb[k] <= ya[k] for k in ya)
    assert b["climate"]["scenario"]["rainfall_mm"] == 360
    assert b["data_class"] == "simulated"
    assert sorted(r["profit_rank"] for r in b["results"]) == [1, 2, 3]


def test_simulator_rejects_duplicate_crops():
    with pytest.raises(ValueError):
        simulator.SimulationInput(district="Ampara", season="maha", area_ha=1,
                                  crops=[{"crop": "paddy", "attainable_yield_t_per_ha": 4, "price_lkr_per_kg": 100}] * 2)
