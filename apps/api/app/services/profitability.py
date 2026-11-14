"""Profitability formulas. All monetary values in LKR; area in hectares."""
from pydantic import BaseModel, Field

HA_PER_ACRE = 0.404686


class CostInputs(BaseModel):
    seed: float = Field(0, ge=0)
    fertilizer: float = Field(0, ge=0)
    labor: float = Field(0, ge=0)
    irrigation: float = Field(0, ge=0)
    transport: float = Field(0, ge=0)
    other: float = Field(0, ge=0)

    def total(self) -> float:
        return self.seed + self.fertilizer + self.labor + self.irrigation + self.transport + self.other


class ProfitInputs(BaseModel):
    crop: str
    area_ha: float = Field(gt=0, le=100000)
    yield_t_per_ha: float = Field(ge=0, le=50)
    price_lkr_per_kg: float = Field(ge=0, le=100000)
    costs_per_ha: CostInputs = CostInputs()


def compute(p: ProfitInputs) -> dict:
    production_kg = p.yield_t_per_ha * 1000 * p.area_ha
    revenue = production_kg * p.price_lkr_per_kg
    cost_ha = p.costs_per_ha.total()
    total_cost = cost_ha * p.area_ha
    profit = revenue - total_cost
    roi = (profit / total_cost * 100) if total_cost > 0 else None
    area_acres = p.area_ha / HA_PER_ACRE
    return {
        "crop": p.crop, "area_ha": p.area_ha, "production_kg": round(production_kg, 1),
        "revenue_lkr": round(revenue, 2), "total_cost_lkr": round(total_cost, 2),
        "cost_breakdown_lkr": {k: round(v * p.area_ha, 2) for k, v in p.costs_per_ha.model_dump().items()},
        "net_profit_lkr": round(profit, 2), "roi_pct": round(roi, 2) if roi is not None else None,
        "profit_per_ha_lkr": round(profit / p.area_ha, 2), "profit_per_acre_lkr": round(profit / area_acres, 2),
        "breakeven_price_lkr_per_kg": round(total_cost / production_kg, 2) if production_kg else None,
        "breakeven_yield_t_per_ha": round(cost_ha / (p.price_lkr_per_kg * 1000), 3) if p.price_lkr_per_kg else None,
    }


def rank(results: list[dict]) -> list[dict]:
    return sorted(results, key=lambda r: r["net_profit_lkr"], reverse=True)
