# geospatial-processing

Current implementation lives in the API package so it can be shared by FastAPI, Celery and n8n-triggered jobs:
`apps/api/app/services/nasa_power.py`, `earthdata.py` and `jobs.py`. See `docs/continuation.md` steps 3–4 for
what will be built here (credentialed downloads, HDF5/COG raster processing, zonal statistics).
