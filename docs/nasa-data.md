# Earth observation data

| Source | Product | Resolution | Access | Status |
|---|---|---|---|---|
| NASA POWER | Daily API, AG community (T2M, T2M_MAX/MIN, RH2M, PRECTOTCORR, ALLSKY_SFC_SW_DWN, WS2M) | 0.5° × 0.625° (MERRA-2); 1° (CERES solar) | Public REST, no key | Implemented |
| NASA POWER | Climatology 2001–2020 | 0.5° × 0.625° | Public REST | Implemented |
| NASA POWER | GWETTOP / GWETROOT soil wetness (MERRA-2 **model**, not satellite) | 0.5° × 0.625° | Public REST | Implemented, labelled as model data |
| NASA GES DISC | GPM_3IMERGDF v07 | 0.1° | CMR + Earthdata Login | Discovery implemented |
| NASA NSIDC | SPL3SMP_E, SPL4SMGP | 9 km | CMR + Earthdata Login | Discovery implemented |
| Copernicus | Sentinel-2 L2A (NDVI) | 10 m | CDSE / Sentinel Hub | Not configured |

## Earthdata setup
1. Create an account at https://urs.earthdata.nasa.gov/ and approve the "NASA GESDISC DATA ARCHIVE" and "NSIDC" applications.
2. Generate a user token (Profile → Generate Token) and set `EARTHDATA_TOKEN` on the API/worker only.

## Behaviour on failure
Upstream failures return HTTP 503 `upstream_unavailable`, mark the source `degraded` (visible in the admin dashboard
and on the home page), and **no substitute values are produced**. POWER lags real time by a few days, so default
windows end 5 days ago. Point values describe a ~50 km grid cell and are labelled as regional indicators.
