"""Transparent agricultural risk index (decision-support estimate — NOT an underwriting or credit decision).

Each component is 0 (low) – 100 (high). Missing components are excluded and reported, never imputed.
"""
import statistics

METHOD_VERSION = "risk-v1.0"
DEFAULT_WEIGHTS = {"climate": 0.35, "production": 0.40, "market": 0.25}


def rainfall_anomaly_pct(observed_mm: float, normal_mm: float) -> float | None:
    if not normal_mm:
        return None
    return (observed_mm - normal_mm) / normal_mm * 100


def climate_risk(rain_anomaly_pct: float | None, max_temp_c: float | None = None, heavy_rain_days: int | None = None) -> dict:
    parts = {}
    if rain_anomaly_pct is not None:
        # deficits weigh more than surpluses; ±50% saturates
        a = rain_anomaly_pct
        parts["drought"] = min(100.0, max(0.0, -a * 2)) if a < 0 else 0.0
        parts["excess_rain"] = min(100.0, max(0.0, (a - 20) * 1.5)) if a > 20 else 0.0
    if max_temp_c is not None:
        parts["heat"] = min(100.0, max(0.0, (max_temp_c - 33) * 20))
    if heavy_rain_days is not None:
        parts["heavy_rain"] = min(100.0, heavy_rain_days * 10.0)
    score = max(parts.values()) * 0.6 + statistics.mean(parts.values()) * 0.4 if parts else None
    return {"score": round(score, 1) if score is not None else None, "components": {k: round(v, 1) for k, v in parts.items()}}


def production_risk(suitability_score: float | None, water_satisfaction: float | None = None, ndvi_anomaly: float | None = None) -> dict:
    parts = {}
    if suitability_score is not None:
        parts["suitability"] = 100 - suitability_score
    if water_satisfaction is not None:
        parts["water_stress"] = (1 - water_satisfaction) * 100
    if ndvi_anomaly is not None:
        parts["vegetation"] = min(100.0, max(0.0, -ndvi_anomaly * 300))
    score = statistics.mean(parts.values()) if parts else None
    return {"score": round(score, 1) if score is not None else None, "components": {k: round(v, 1) for k, v in parts.items()}}


def market_risk(prices: list[float]) -> dict:
    """Coefficient of variation of the supplied price series (needs ≥ 6 points)."""
    if len(prices) < 6:
        return {"score": None, "components": {}, "note": "Insufficient market price history (need ≥ 6 observations)"}
    mean = statistics.mean(prices)
    cv = statistics.pstdev(prices) / mean if mean else 0
    return {"score": round(min(100.0, cv * 250), 1), "components": {"price_cv": round(cv, 3)}}


def overall(climate: dict, production: dict, market: dict, weights: dict | None = None) -> dict:
    w = {**DEFAULT_WEIGHTS, **(weights or {})}
    comps = {"climate": climate.get("score"), "production": production.get("score"), "market": market.get("score")}
    avail = {k: v for k, v in comps.items() if v is not None}
    missing = [k for k, v in comps.items() if v is None]
    if not avail:
        return {"score": None, "level": "unknown", "missing": missing}
    tw = sum(w[k] for k in avail)
    score = sum(v * w[k] for k, v in avail.items()) / tw
    return {"score": round(score, 1), "level": level(score), "missing": missing, "weights": w,
            "label": "Decision-support estimate — not a validated underwriting or credit decision"}


def level(score: float) -> str:
    return "high" if score >= 60 else "elevated" if score >= 40 else "moderate" if score >= 20 else "low"
