# sri_lanka_nasa.json: field reference

`null` always means NASA hasn't delivered that value yet. The kit never fills it with an estimate.

## Top level
| Field | Meaning |
|---|---|
| `generated_at` | When the file was written (UTC) |
| `demo` | `true` only in the bundled sample file |
| `sources.<dataset>` | `status` (loaded / error / not loaded), `values_stored`, `latest_observation`, `last_error`, resolution, cadence |
| `weights` | Weights used for crop suitability and crop condition |
| `districts.<Name>` | One entry per district (25), described below |
| `farms.<name>` | Landsat NDVI for your farm polygons: `latest_ndvi`, `date`, `series` (last 24 values) |

## districts.\<Name\>
| Field | Source | Meaning / unit |
|---|---|---|
| `code`, `province`, `lat`, `lon` | DCS boundaries | District code LK-11…LK-92 and an interior point |
| `nasa_power.last_30_days.mean_temp_c`, `max_temp_c` | NASA POWER T2M, T2M_MAX | °C |
| `nasa_power.last_30_days.rain_mm` | NASA POWER PRECTOTCORR | mm in 30 days (coarse; prefer GPM) |
| `nasa_power.last_30_days.humidity_pct`, `solar_kwh_m2`, `wind_ms` | NASA POWER RH2M, ALLSKY_SFC_SW_DWN, WS2M | %, kWh/m²/day, m/s |
| `nasa_power.season_normals_2001_2020.maha / yala` | NASA POWER climatology | Mean temperature (°C) and season rainfall total (mm); Maha = Oct–Feb, Yala = Apr–Aug |
| `gpm_imerg.rain_30_days.total_mm` | GPM IMERG (Final where available, otherwise Late) | District-mean rainfall over the last 30 stored days |
| `…anomaly_pct`, `normal_mm` | GPM vs NASA POWER normal | % above (+) or below (−) normal |
| `…heavy_rain_days_50mm`, `wettest_day_mm` | GPM IMERG | Count of days and mm |
| `smap.root_zone_wetness` | SMAP L4 (SPL4SMGP) | 0 = dry … 1 = saturated, 0–100 cm |
| `smap.surface_soil_moisture_m3m3` | SMAP L3 (SPL3SMP_E) | m³/m³, top 5 cm |
| `smap.water_stress` | from root-zone wetness | high < 0.25 ≤ moderate < 0.40 ≤ low |
| `smap.fallback_merra2_root_zone` | NASA POWER GWETROOT | Used only while SMAP has no value |
| `modis.ndvi.ndvi`, `date` | MODIS MOD13Q1 | −0.2 … 1 |
| `modis.ndvi.normal`, `anomaly`, `baseline_years` | MODIS history | Same ±16 days in previous years; needs ≥ 2 years |
| `ecostress.surface_temp_c`, `heat_stress` | ECOSTRESS LSTE | °C; high ≥ 42, medium ≥ 35 |
| `ecostress.evapotranspiration.et`, `relative_to_usual_high` | ECOSTRESS L3T JET | ET, and its ratio to the district's 90th percentile (needs ≥ 8 values) |
| `srtm.elevation_mean / min / max / std` | SRTM | Metres |
| `crop_suitability_inputs` | POWER + SMAP + SRTM | Ready-made inputs for a crop-suitability model, with the source of each |
| `crop_condition.score` / `level` | MODIS + ECOSTRESS + SMAP + GPM | 0–100; good ≥ 70, fair ≥ 45, poor below that |
| `crop_condition.components` | | Each part scored 0–100 |
| `crop_condition.weights_used`, `missing` | | Weights rescaled to the parts that were available |

## CSV
`sri_lanka_nasa_observations.csv` has these columns: `dataset, place, date, metric, value, units`. `place` is a district name, or `farm:<name>`.
