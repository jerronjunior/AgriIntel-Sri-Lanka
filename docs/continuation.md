# Continuation plan

Phases 1–3 and most of 6–7 are implemented. Remaining work, in order:

1. **Live NASA verification** — deploy, run workflow 01 manually, confirm `satellite_data_sources.status = operational`
   and spot-check a district against the POWER web viewer.
2. **District polygons** — load official ADM2 boundaries (Survey Department of Sri Lanka or geoBoundaries LKA ADM2,
   check licence) into a `district_boundaries` PostGIS table; replace district points with fills on the map.
3. **GPM IMERG / SMAP processing** (`services/geospatial-processing`) — worker downloads discovered granules with
   `EARTHDATA_TOKEN`, reads HDF5 with h5py/rasterio, clips to Sri Lanka, computes district zonal stats into
   `climate_observations` / `soil_moisture_observations` (new source keys), writes COG tiles to blob storage, exposes
   `/satellite/tiles/{layer}/{z}/{x}/{y}`; flip the layer `kind` to available.
4. **Sentinel-2 NDVI** — Copernicus Data Space Ecosystem Process API per farm boundary → `vegetation_observations`.
5. **Agronomic review** — have the crop parameters in `app/data/crops.py` reviewed; update via
   `PATCH /admin/crop-requirements/{crop}` with `reviewed=true`.
6. **Yield models** — assemble DCS district production + POWER features, run `services/ml-models/train_yield.py
   --register`, publish only if it beats the baseline on held-out years; then add `/yield/predict`.
7. **Industry portfolio views** — insurance/bank portfolio uploads (exposures per district) and exposure maps.
8. **3D agricultural landscape** scene, **LLM assistant** (server-side, grounded on API data), **BFF cookie auth + CSP**.
