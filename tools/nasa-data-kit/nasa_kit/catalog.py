"""Every NASA dataset the kit collects, with access route and plausible value ranges."""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Dataset:
    key: str
    title: str
    mission: str
    provider: str           # power | gesdisc | appeears
    resolution: str
    cadence: str
    metric: str = ""
    unit: str = ""
    valid: tuple[float, float] = (float("-inf"), float("inf"))
    products: tuple[str, ...] = ()      # AppEEARS candidates, first available wins (NASA versions products)
    layers: tuple[str, ...] = ()        # AppEEARS layer-name suffixes
    scope: str = "districts"            # districts | farms
    static: bool = False
    kelvin_to_c: bool = False
    extra: dict = field(default_factory=dict)
    credentials: str = "none"


DATASETS = {d.key: d for d in [
    Dataset("nasa_power", "NASA POWER daily weather + 2001–2020 normals", "MERRA-2 / CERES", "power", "~50 km (0.5° × 0.625°)", "daily",
            credentials="none"),
    Dataset("gpm_imerg_late", "GPM IMERG Late daily rainfall", "GPM (NASA/JAXA)", "gesdisc", "0.1° (~11 km)", "daily, ~1–2 day delay",
            "precip_mm", "mm/day", (0, 600), ("GPM_3IMERGDL", "07"), credentials="EARTHDATA_TOKEN"),
    Dataset("gpm_imerg_final", "GPM IMERG Final daily rainfall", "GPM (NASA/JAXA)", "gesdisc", "0.1° (~11 km)", "daily, ~3.5 month delay",
            "precip_mm", "mm/day", (0, 600), ("GPM_3IMERGDF", "07"), credentials="EARTHDATA_TOKEN"),
    Dataset("smap_l4_rootzone", "SMAP L4 root-zone soil wetness", "SMAP", "appeears", "9 km", "3-hourly → daily mean",
            "smap_rootzone_wetness", "0–1", (0, 1), ("SPL4SMGP.008", "SPL4SMGP.007"), ("sm_rootzone_wetness",), credentials="EARTHDATA_USERNAME/PASSWORD"),
    Dataset("smap_l3_surface", "SMAP L3 surface soil moisture", "SMAP", "appeears", "9 km", "daily",
            "smap_surface_sm", "m³/m³", (0, 0.9), ("SPL3SMP_E.006", "SPL3SMP_E.005"), ("AM_soil_moisture", "soil_moisture"), credentials="EARTHDATA_USERNAME/PASSWORD"),
    Dataset("modis_ndvi", "MODIS NDVI (MOD13Q1)", "Terra MODIS", "appeears", "250 m", "16-day composite",
            "ndvi", "index", (-0.2, 1.0), ("MOD13Q1.061",), ("_250m_16_days_NDVI",), credentials="EARTHDATA_USERNAME/PASSWORD"),
    Dataset("landsat_ndvi", "Landsat NDVI (HLS L30 Vegetation Indices)", "Landsat 8/9", "appeears", "30 m", "2–4 days, cloud permitting",
            "ndvi", "index", (-0.2, 1.0), ("HLSL30_VI.002", "HLSL30_VI.020"), ("NDVI",), scope="farms", credentials="EARTHDATA_USERNAME/PASSWORD"),
    Dataset("ecostress_lst", "ECOSTRESS land surface temperature", "ECOSTRESS (ISS)", "appeears", "70 m", "irregular overpasses",
            "lst_c", "°C", (5, 75), ("ECO_L2T_LSTE.002",), ("LST",), kelvin_to_c=True, credentials="EARTHDATA_USERNAME/PASSWORD"),
    Dataset("ecostress_et", "ECOSTRESS daily evapotranspiration", "ECOSTRESS (ISS)", "appeears", "70 m", "irregular overpasses",
            "et_daily", "", (0, 1000), ("ECO_L3T_JET.002",), ("ETdaily",), credentials="EARTHDATA_USERNAME/PASSWORD"),
    Dataset("srtm", "SRTM elevation", "Shuttle Radar Topography Mission", "appeears", "90 m / 30 m", "static (2000)",
            "elevation_mean", "m", (-10, 2600), ("SRTMGL3_NC.003", "SRTMGL1_NC.003", "NASADEM_NC.001"), ("SRTMGL3_DEM", "SRTMGL1_DEM", "NASADEM_HGT"),
            static=True, extra={"Standard Deviation": "elevation_std", "Maximum": "elevation_max", "Minimum": "elevation_min"},
            credentials="EARTHDATA_USERNAME/PASSWORD"),
]}

APPEEARS = [d for d in DATASETS.values() if d.provider == "appeears"]

# How much each dataset counts (configurable starting points — review with an agronomist before operational use)
SUITABILITY_WEIGHTS = {"water (NASA POWER rainfall normal)": 0.35, "temperature (NASA POWER)": 0.30,
                       "soil_moisture (SMAP L4)": 0.15, "elevation (SRTM)": 0.10, "terrain (SRTM ruggedness)": 0.10}
CONDITION_WEIGHTS = {"vegetation": 0.30, "heat_water": 0.25, "soil_water": 0.25, "rainfall": 0.20}
