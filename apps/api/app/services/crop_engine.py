"""Transparent, rules-based crop suitability model (v1).

Each factor is scored 0–100 with a trapezoidal membership function between the crop's
absolute and optimal ranges. The overall score blends the weighted mean with the most
limiting factor (Liebig's law of the minimum), so one fatal constraint cannot be averaged away.

This is a decision-support heuristic with configurable weights — NOT a trained or validated
AI model. Scores are not probabilities.
"""
from __future__ import annotations

ENGINE_VERSION = "rules-v1.0"

DEFAULT_WEIGHTS = {"temperature": 0.35, "water": 0.45, "elevation": 0.10, "soil_moisture": 0.10}
MIN_BLEND = 0.4  # overall = (1-MIN_BLEND)*weighted_mean + MIN_BLEND*min_factor
IRRIGATION_SUPPLY = {"none": 0.0, "partial": 0.5, "full": 1.0}  # share of the water deficit covered
EFFECTIVE_RAIN_FACTOR = 0.8  # share of seasonal rainfall assumed usable by the crop (configurable assumption)


def trapezoid(x: float, abs_lo: float, opt_lo: float, opt_hi: float, abs_hi: float) -> float:
    if x <= abs_lo or x >= abs_hi:
        return 0.0
    if opt_lo <= x <= opt_hi:
        return 100.0
    if x < opt_lo:
        return 100.0 * (x - abs_lo) / (opt_lo - abs_lo)
    return 100.0 * (abs_hi - x) / (abs_hi - opt_hi)


def water_balance(req: dict, rainfall_mm: float, irrigation: str) -> dict:
    demand = (req["water_mm"][0] + req["water_mm"][1]) / 2
    effective_rain = max(rainfall_mm, 0) * EFFECTIVE_RAIN_FACTOR
    deficit = max(demand - effective_rain, 0)
    irrigation_mm = deficit * IRRIGATION_SUPPLY.get(irrigation, 0)
    supply = effective_rain + irrigation_mm
    return {"demand_mm": round(demand, 1), "effective_rain_mm": round(effective_rain, 1),
            "irrigation_mm": round(irrigation_mm, 1), "supply_mm": round(supply, 1),
            "deficit_mm": round(max(demand - supply, 0), 1), "surplus_mm": round(max(supply - demand, 0), 1),
            "satisfaction": round(min(supply / demand, 1.0), 3) if demand else 1.0}


def score_crop(key: str, req: dict, *, mean_temp_c: float, rainfall_mm: float, irrigation: str = "none",
               elevation_m: float | None = None, soil_moisture_root: float | None = None,
               weights: dict | None = None) -> dict:
    w = {**DEFAULT_WEIGHTS, **(weights or {})}
    factors: dict[str, float] = {}
    notes: list[str] = []
    constraints: list[str] = []

    t_lo, t_hi = req["temp_opt"]
    ta_lo, ta_hi = req["temp_abs"]
    factors["temperature"] = trapezoid(mean_temp_c, ta_lo, t_lo, t_hi, ta_hi)
    if mean_temp_c < t_lo:
        constraints.append(f"Seasonal mean temperature {mean_temp_c:.1f}°C is below the optimal {t_lo}–{t_hi}°C band")
    elif mean_temp_c > t_hi:
        constraints.append(f"Seasonal mean temperature {mean_temp_c:.1f}°C is above the optimal {t_lo}–{t_hi}°C band")

    wb = water_balance(req, rainfall_mm, irrigation)
    supply, (w_lo, w_hi) = wb["supply_mm"], req["water_mm"]
    abs_min = req["water_abs_min_mm"]
    # excess-water tolerance: tolerant crops accept up to 2.5× upper band, others 1.6×
    abs_max = w_hi * (2.5 if req.get("waterlog_tolerant") else 1.6)
    factors["water"] = trapezoid(supply, abs_min * 0.7, w_lo, w_hi, abs_max)
    if wb["deficit_mm"] > 0:
        constraints.append(f"Water deficit of ~{wb['deficit_mm']:.0f} mm against a ~{wb['demand_mm']:.0f} mm seasonal requirement")
    if supply > w_hi * 1.3 and not req.get("waterlog_tolerant"):
        constraints.append("Seasonal water supply well above requirement — waterlogging/disease risk for a non-tolerant crop")

    if elevation_m is not None:
        emax = req["elev_max_m"]
        factors["elevation"] = 100.0 if elevation_m <= emax else max(0.0, 100 - (elevation_m - emax) / 5)
        if elevation_m > emax:
            constraints.append(f"Elevation {elevation_m:.0f} m exceeds typical limit of {emax} m")
    else:
        notes.append("Elevation not supplied — factor excluded")

    if soil_moisture_root is not None:
        # root-zone wetness fraction (0–1): stress below 0.3; waterlogging concern above 0.85 for non-tolerant crops
        sm = soil_moisture_root
        hi = 1.01 if req.get("waterlog_tolerant") else 0.95
        factors["soil_moisture"] = trapezoid(sm, 0.1, 0.35 if not req.get("waterlog_tolerant") else 0.5, 0.85, hi)
        notes.append("Soil moisture is coarse grid-cell data — indicative only, not field-level")
    else:
        notes.append("Soil moisture not supplied — factor excluded")

    used_w = {k: w[k] for k in factors}
    total_w = sum(used_w.values()) or 1
    weighted = sum(factors[k] * used_w[k] for k in factors) / total_w
    minimum = min(factors.values())
    overall = (1 - MIN_BLEND) * weighted + MIN_BLEND * minimum

    return {
        "crop": key, "name": req.get("name", key), "score": round(overall, 1),
        "class": classify(overall), "factors": {k: round(v, 1) for k, v in factors.items()},
        "limiting_factor": min(factors, key=factors.get), "water_balance": wb,
        "constraints": constraints, "notes": notes,
    }


def classify(score: float) -> str:
    if score >= 75:
        return "highly suitable"
    if score >= 55:
        return "suitable"
    if score >= 35:
        return "marginal"
    return "not suitable"


def recommend(crops: dict[str, dict], **inputs) -> dict:
    ranked = sorted((score_crop(k, v, **inputs) for k, v in crops.items()), key=lambda r: r["score"], reverse=True)
    best = ranked[0] if ranked else None
    second = ranked[1] if len(ranked) > 1 else None
    avoid = [r["crop"] for r in ranked if r["class"] == "not suitable"]
    explanation = []
    if best:
        explanation.append(
            f"{best['name']} ranks highest ({best['score']}/100, {best['class']}); its most limiting factor is "
            f"{best['limiting_factor'].replace('_', ' ')} ({best['factors'][best['limiting_factor']]}/100)."
        )
    if second:
        explanation.append(f"{second['name']} is the second option ({second['score']}/100).")
    if avoid:
        explanation.append("Avoid: " + ", ".join(r["name"] for r in ranked if r["crop"] in avoid) + ".")
    return {
        "engine_version": ENGINE_VERSION, "recommended": best["crop"] if best else None,
        "second_best": second["crop"] if second else None, "avoid": avoid, "ranking": ranked,
        "explanation": " ".join(explanation),
        "disclaimer": "Rules-based decision-support estimate using indicative crop parameters. Not a validated AI prediction.",
    }
