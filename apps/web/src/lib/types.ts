export type Membership = { org_id: string; org_name: string; industry: string; role: string; plan_key: string | null; features: string[]; subscription_status: string | null };
export type Me = { id: string; email: string; full_name: string; is_superadmin: boolean; email_verified: boolean; memberships: Membership[] };
export type District = { name: string; province: string; lat: number; lon: number };
export type Provenance = { source_key: string; provider?: string; product?: string; spatial_resolution?: string; status?: string; processed_at?: string; data_class?: string; limitation?: string; note?: string; period?: string; url?: string };
export type Plan = { id: string; key: string; name: string; description: string; audience: string; price_amount: number | null; price_currency: string | null; billing_period: string | null; features: string[]; limits: Record<string, number | null> };
export type Farm = { id: string; name: string; district: string; latitude: number; longitude: number; area_ha: number | null; irrigation: string; notes: string; created_at: string; boundary_geojson: GeoJSON.Polygon | GeoJSON.MultiPolygon | null };
export type CropResult = { crop: string; name: string; score: number; class: string; factors: Record<string, number>; limiting_factor: string; constraints: string[]; notes: string[]; water_balance: { demand_mm: number; supply_mm: number; deficit_mm: number; satisfaction: number } };
export type SimRow = {
  crop: string; name: string; suitability_baseline: number; suitability_scenario: number; suitability_class: string; limiting_factor: string; constraints: string[];
  profit_rank: number; suitability_rank: number;
  water: { demand_mm: number; deficit_mm: number; demand_m3: number; deficit_m3: number; irrigation_m3: number; satisfaction: number };
  yield: { attainable_t_per_ha: number; expected_t_per_ha: number; yield_factor: number; ky: number; ky_source: string };
  economics: { revenue_lkr: number; total_cost_lkr: number; net_profit_lkr: number; roi_pct: number | null; profit_per_acre_lkr: number; production_kg: number };
  risk: { overall: { score: number | null; level: string; missing: string[] } };
};
export type Simulation = { id: string; name: string; inputs: Record<string, unknown>; climate: { baseline: { mean_temp_c: number; rainfall_mm: number; elevation_m: number | null; source: string }; scenario: { mean_temp_c: number; rainfall_mm: number } }; results: SimRow[]; assumptions: Record<string, unknown>; disclaimer: string };
