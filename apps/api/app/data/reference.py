"""Static reference data seeded into the database (idempotent, see app/seed.py)."""

# ----------------------------------------------------------------- roles & permissions
PERMISSIONS = {
    "org:read", "org:manage", "members:manage", "billing:read",
    "farms:read", "farms:write",
    "intel:read", "simulations:run", "reports:create",
    "market:import", "audit:read",
}

ROLES: dict[str, dict] = {
    "org_admin": {"name": "Organization Admin", "permissions": sorted(PERMISSIONS)},
    "farm_manager": {"name": "Farm Manager", "permissions": ["org:read", "farms:read", "farms:write", "intel:read", "simulations:run", "reports:create"]},
    "insurance_analyst": {"name": "Insurance Analyst", "permissions": ["org:read", "farms:read", "intel:read", "simulations:run", "reports:create"]},
    "banking_analyst": {"name": "Banking Analyst", "permissions": ["org:read", "farms:read", "intel:read", "simulations:run", "reports:create"]},
    "government_analyst": {"name": "Government Analyst", "permissions": ["org:read", "farms:read", "intel:read", "simulations:run", "reports:create"]},
    "viewer": {"name": "Viewer", "permissions": ["org:read", "farms:read", "intel:read"]},
}
# "Platform Super Admin" is a user-level flag (users.is_superadmin), not an org role.

INDUSTRY_DEFAULT_ROLE = {
    "farm": "farm_manager", "insurance": "insurance_analyst", "banking": "banking_analyst",
    "government": "government_analyst", "agribusiness": "farm_manager",
}

# ----------------------------------------------------------------- plans (no prices: admin-configured)
FEATURES = {
    "map": "Satellite intelligence map",
    "climate": "Climate intelligence (NASA POWER)",
    "soil_water": "Soil & water intelligence",
    "crop_suitability": "Crop suitability engine",
    "profitability": "Profitability calculator",
    "simulator": "Decision Simulator",
    "market": "Market intelligence",
    "risk": "Agricultural risk engine",
    "portfolio_risk": "Portfolio exposure views",
    "reports_pdf": "PDF reports",
    "api_access": "API access",
    "automation": "Scheduled alerts & reports",
}

PLANS = [
    {"key": "farm", "name": "Farm Intelligence", "audience": "Commercial farms & agribusiness", "sort_order": 1,
     "description": "Field-level decision support for growers.",
     "features": ["map", "climate", "soil_water", "crop_suitability", "profitability", "simulator", "market", "reports_pdf"],
     "limits": {"max_farms": 25, "max_users": 5, "max_simulations_per_month": 200}},
    {"key": "insurance", "name": "Insurance Intelligence", "audience": "Agricultural insurers", "sort_order": 2,
     "description": "Regional drought and flood exposure for underwriting support.",
     "features": ["map", "climate", "soil_water", "risk", "portfolio_risk", "market", "simulator", "reports_pdf", "automation"],
     "limits": {"max_farms": 2000, "max_users": 20, "max_simulations_per_month": 1000}},
    {"key": "banking", "name": "Banking Intelligence", "audience": "Agricultural lenders", "sort_order": 3,
     "description": "Climate-aware lending decision support.",
     "features": ["map", "climate", "soil_water", "risk", "portfolio_risk", "profitability", "simulator", "market", "reports_pdf", "automation"],
     "limits": {"max_farms": 5000, "max_users": 30, "max_simulations_per_month": 2000}},
    {"key": "enterprise", "name": "Enterprise Intelligence", "audience": "Government & large enterprises", "sort_order": 4,
     "description": "All modules, API access and custom integrations.",
     "features": sorted(FEATURES.keys()),
     "limits": {"max_farms": None, "max_users": None, "max_simulations_per_month": None}},
]

# ----------------------------------------------------------------- Sri Lanka districts
# Approximate district centroids (WGS84) used only for point sampling of coarse gridded
# products (NASA POWER grid cells are ~50 km). Replace with official boundaries for polygons.
DISTRICTS: list[dict] = [
    {"name": "Colombo", "province": "Western", "lat": 6.87, "lon": 80.02},
    {"name": "Gampaha", "province": "Western", "lat": 7.09, "lon": 80.01},
    {"name": "Kalutara", "province": "Western", "lat": 6.60, "lon": 80.15},
    {"name": "Kandy", "province": "Central", "lat": 7.29, "lon": 80.70},
    {"name": "Matale", "province": "Central", "lat": 7.62, "lon": 80.68},
    {"name": "Nuwara Eliya", "province": "Central", "lat": 6.97, "lon": 80.77},
    {"name": "Galle", "province": "Southern", "lat": 6.17, "lon": 80.27},
    {"name": "Matara", "province": "Southern", "lat": 6.07, "lon": 80.55},
    {"name": "Hambantota", "province": "Southern", "lat": 6.27, "lon": 81.10},
    {"name": "Jaffna", "province": "Northern", "lat": 9.68, "lon": 80.05},
    {"name": "Kilinochchi", "province": "Northern", "lat": 9.40, "lon": 80.40},
    {"name": "Mannar", "province": "Northern", "lat": 8.85, "lon": 80.05},
    {"name": "Vavuniya", "province": "Northern", "lat": 8.75, "lon": 80.50},
    {"name": "Mullaitivu", "province": "Northern", "lat": 9.18, "lon": 80.70},
    {"name": "Batticaloa", "province": "Eastern", "lat": 7.73, "lon": 81.60},
    {"name": "Ampara", "province": "Eastern", "lat": 7.28, "lon": 81.62},
    {"name": "Trincomalee", "province": "Eastern", "lat": 8.58, "lon": 81.05},
    {"name": "Kurunegala", "province": "North Western", "lat": 7.48, "lon": 80.36},
    {"name": "Puttalam", "province": "North Western", "lat": 8.03, "lon": 79.85},
    {"name": "Anuradhapura", "province": "North Central", "lat": 8.33, "lon": 80.40},
    {"name": "Polonnaruwa", "province": "North Central", "lat": 7.93, "lon": 81.00},
    {"name": "Badulla", "province": "Uva", "lat": 6.99, "lon": 81.05},
    {"name": "Monaragala", "province": "Uva", "lat": 6.87, "lon": 81.35},
    {"name": "Ratnapura", "province": "Sabaragamuwa", "lat": 6.68, "lon": 80.40},
    {"name": "Kegalle", "province": "Sabaragamuwa", "lat": 7.25, "lon": 80.35},
]
DISTRICT_BY_NAME = {d["name"].lower(): d for d in DISTRICTS}

# ----------------------------------------------------------------- data sources (provenance)
DATA_SOURCES = [
    {"key": "nasa_power_daily", "provider": "NASA Langley Research Center — POWER Project", "mission": "MERRA-2 (meteorology), CERES (solar)",
     "product": "POWER Daily API, AG community", "spatial_resolution": "0.5° × 0.625° (meteorology); 1° × 1° (solar)",
     "temporal_resolution": "Daily", "access_method": "Public REST API (no key)", "requires_credentials": False,
     "status": "operational", "url": "https://power.larc.nasa.gov/"},
    {"key": "nasa_power_climatology", "provider": "NASA Langley Research Center — POWER Project", "mission": "MERRA-2, CERES",
     "product": "POWER Climatology API (2001–2020 monthly normals)", "spatial_resolution": "0.5° × 0.625° (meteorology)",
     "temporal_resolution": "Monthly climatology", "access_method": "Public REST API (no key)", "requires_credentials": False,
     "status": "operational", "url": "https://power.larc.nasa.gov/"},
    {"key": "nasa_power_soil_wetness", "provider": "NASA Langley Research Center — POWER Project", "mission": "MERRA-2 reanalysis (model, not satellite-observed)",
     "product": "GWETTOP / GWETROOT soil wetness fraction", "spatial_resolution": "0.5° × 0.625°",
     "temporal_resolution": "Daily", "access_method": "Public REST API (no key)", "requires_credentials": False,
     "status": "operational", "url": "https://power.larc.nasa.gov/"},
    {"key": "gpm_imerg_final", "provider": "NASA GES DISC", "mission": "GPM (NASA/JAXA)",
     "product": "GPM_3IMERGDF — IMERG Final Run daily", "spatial_resolution": "0.1° × 0.1°",
     "temporal_resolution": "Daily", "access_method": "CMR discovery + Earthdata Login download", "requires_credentials": True,
     "status": "pending_implementation", "url": "https://gpm.nasa.gov/data/imerg"},
    {"key": "smap_l3_enhanced", "provider": "NASA NSIDC DAAC", "mission": "SMAP",
     "product": "SPL3SMP_E — L3 Radiometer Global Daily 9 km EASE-Grid Soil Moisture", "spatial_resolution": "9 km",
     "temporal_resolution": "Daily", "access_method": "CMR discovery + Earthdata Login download", "requires_credentials": True,
     "status": "pending_implementation", "url": "https://smap.jpl.nasa.gov/"},
    {"key": "smap_l4_rootzone", "provider": "NASA NSIDC DAAC", "mission": "SMAP (L4 data-assimilation product)",
     "product": "SPL4SMGP — L4 Global 3-hourly 9 km Surface and Root Zone Soil Moisture", "spatial_resolution": "9 km",
     "temporal_resolution": "3-hourly", "access_method": "CMR discovery + Earthdata Login download", "requires_credentials": True,
     "status": "pending_implementation", "url": "https://smap.jpl.nasa.gov/"},
    {"key": "sentinel2_l2a", "provider": "Copernicus (ESA / European Commission) — not a NASA mission", "mission": "Sentinel-2",
     "product": "Sentinel-2 L2A surface reflectance (NDVI from B08/B04)", "spatial_resolution": "10 m",
     "temporal_resolution": "~5-day revisit", "access_method": "Authorized provider (e.g. Copernicus Data Space Ecosystem / Sentinel Hub)",
     "requires_credentials": True, "status": "not_configured", "url": "https://dataspace.copernicus.eu/"},
]
