"""AgriIntel Decision Simulator — hypothetical scenario engine.

Combines a climate baseline (NASA POWER 2001–2020 climatology, or user-supplied values) with
user perturbations (rainfall %, temperature °C, irrigation) and user economic assumptions.

Yield adjustment uses the FAO-33 relationship  1 − Ya/Ym = Ky · (1 − ETa/ETm),
with ETa/ETm approximated by the seasonal water-satisfaction ratio, and a thermal factor equal to
the temperature suitability (0–1). Ym is the *user-supplied* attainable yield. This is a
scenario heuristic, not a validated yield model; outputs are hypothetical.
"""
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.services import crop_engine, profitability, risk

ENGINE_VERSION = "simulator-v1.0"


class CropScenario(BaseModel):
    crop: str
    attainable_yield_t_per_ha: float = Field(gt=0, le=50, description="User assumption: yield under good conditions")
    price_lkr_per_kg: float = Field(ge=0, le=100000, description="User assumption or imported market price")
    costs_per_ha: profitability.CostInputs = profitability.CostInputs()


class ClimateBaseline(BaseModel):
    mean_temp_c: float = Field(ge=-5, le=45)
    rainfall_mm: float = Field(ge=0, le=6000)
    elevation_m: float | None = Field(default=None, ge=0, le=2600)
    source: str = "user-supplied"


class SimulationInput(BaseModel):
    name: str = Field(default="Scenario", max_length=200)
    district: str
    farm_id: str | None = None
    season: Literal["maha", "yala"]
    area_ha: float = Field(gt=0, le=100000)
    rain_change_pct: float = Field(default=0, ge=-90, le=200)
    temp_change_c: float = Field(default=0, ge=-5, le=6)
    irrigation: Literal["none", "partial", "full"] = "none"
    crops: list[CropScenario] = Field(min_length=1, max_length=6)
    baseline: ClimateBaseline | None = Field(default=None, description="Omit to load NASA POWER climatology for the district")

    @model_validator(mode="after")
    def unique_crops(self):
        keys = [c.crop for c in self.crops]
        if len(keys) != len(set(keys)):
            raise ValueError("each crop may appear only once")
        return self


def run(inp: SimulationInput, crop_params: dict[str, dict], baseline: ClimateBaseline, price_history: dict[str, list[float]] | None = None) -> dict:
    price_history = price_history or {}
    scen_rain = baseline.rainfall_mm * (1 + inp.rain_change_pct / 100)
    scen_temp = baseline.mean_temp_c + inp.temp_change_c
    rows = []
    for c in inp.crops:
        req = crop_params.get(c.crop)
        if not req:
            raise ValueError(f"unknown crop '{c.crop}'")
        base = crop_engine.score_crop(c.crop, req, mean_temp_c=baseline.mean_temp_c, rainfall_mm=baseline.rainfall_mm,
                                      irrigation=inp.irrigation, elevation_m=baseline.elevation_m)
        scen = crop_engine.score_crop(c.crop, req, mean_temp_c=scen_temp, rainfall_mm=scen_rain,
                                      irrigation=inp.irrigation, elevation_m=baseline.elevation_m)
        wb = scen["water_balance"]
        ky = req.get("ky", 1.0)
        water_factor = max(0.0, 1 - ky * (1 - wb["satisfaction"]))
        thermal_factor = scen["factors"]["temperature"] / 100
        yield_factor = round(water_factor * thermal_factor, 3)
        exp_yield = c.attainable_yield_t_per_ha * yield_factor
        econ = profitability.compute(profitability.ProfitInputs(
            crop=c.crop, area_ha=inp.area_ha, yield_t_per_ha=exp_yield,
            price_lkr_per_kg=c.price_lkr_per_kg, costs_per_ha=c.costs_per_ha))
        anomaly = inp.rain_change_pct  # scenario rainfall vs. baseline normal
        clim = risk.climate_risk(anomaly, max_temp_c=None)
        prod = risk.production_risk(scen["score"], wb["satisfaction"])
        mkt = risk.market_risk(price_history.get(c.crop, []))
        rows.append({
            "crop": c.crop, "name": req.get("name", c.crop),
            "suitability_baseline": base["score"], "suitability_scenario": scen["score"], "suitability_class": scen["class"],
            "limiting_factor": scen["limiting_factor"], "constraints": scen["constraints"],
            "water": {**wb, "demand_m3": round(wb["demand_mm"] * 10 * inp.area_ha, 0),
                      "irrigation_m3": round(wb["irrigation_mm"] * 10 * inp.area_ha, 0),
                      "deficit_m3": round(wb["deficit_mm"] * 10 * inp.area_ha, 0)},
            "yield": {"attainable_t_per_ha": c.attainable_yield_t_per_ha, "ky": ky, "ky_source": req.get("ky_source"),
                      "water_factor": round(water_factor, 3), "thermal_factor": round(thermal_factor, 3),
                      "yield_factor": yield_factor, "expected_t_per_ha": round(exp_yield, 3)},
            "economics": econ,
            "risk": {"climate": clim, "production": prod, "market": mkt, "overall": risk.overall(clim, prod, mkt)},
        })
    ranked = sorted(rows, key=lambda r: (r["economics"]["net_profit_lkr"], r["suitability_scenario"]), reverse=True)
    for i, r in enumerate(ranked, 1):
        r["profit_rank"] = i
    for i, r in enumerate(sorted(rows, key=lambda r: r["suitability_scenario"], reverse=True), 1):
        r["suitability_rank"] = i
    return {
        "engine_version": ENGINE_VERSION, "data_class": "simulated",
        "climate": {"baseline": baseline.model_dump(), "scenario": {"mean_temp_c": round(scen_temp, 2), "rainfall_mm": round(scen_rain, 1)}},
        "results": ranked,
        "assumptions": {
            "effective_rain_factor": crop_engine.EFFECTIVE_RAIN_FACTOR,
            "irrigation_coverage_of_deficit": crop_engine.IRRIGATION_SUPPLY[inp.irrigation],
            "yield_model": "FAO-33 Ky water response × temperature suitability; Ym = user-supplied attainable yield",
            "temperature_effect_on_water_demand": "not modelled in v1",
            "prices_and_costs": "user-supplied",
            "crop_parameters": "indicative defaults — see /api/v1/crops",
        },
        "disclaimer": "Hypothetical scenario for decision support. Not an observation, forecast or validated prediction.",
    }
