# AgriIntel Sri Lanka

**Satellite intelligence. Smarter agricultural decisions.**

A multi-tenant B2B SaaS platform that turns NASA Earth observation data into climate risk,
crop suitability, profitability and scenario intelligence for Sri Lankan agriculture.

```
apps/web        Next.js 15 · React 19 · TypeScript · Tailwind 4 · R3F globe · MapLibre · Recharts · TanStack Query
apps/api        FastAPI · SQLAlchemy 2 · Alembic · PostgreSQL (+PostGIS) with Row Level Security · Celery/Redis
services/       ml-models (yield training pipeline), satellite-ingestion, geospatial-processing (see READMEs)
automation/     8 importable n8n workflows + generator
packages/       shared-types (TypeScript types generated from the OpenAPI schema)
infrastructure/ Dockerfiles · deployment guides
docs/           architecture, NASA data, security, n8n, deployment, continuation plan
```

## Quick start (Docker)

```bash
cp .env.example .env            # set JWT_SECRET, AUTOMATION_API_KEY, passwords
docker compose up --build       # db (PostGIS), redis, migrate+seed, api, web, n8n
```

* Web app: http://localhost:3000 — register an organization, or sign in as the seeded super admin
* API docs (OpenAPI/Swagger): http://localhost:8000/api/v1/docs
* n8n: http://localhost:5678 — import `automation/n8n-workflows/*.json` (see `docs/n8n.md`)

## Quick start (without Docker)

```bash
# Postgres 16 (PostGIS optional) running locally with a superuser "agri"
cd apps/api && pip install -r requirements-dev.txt
export MIGRATION_DATABASE_URL=postgresql+psycopg://agri:agri@localhost:5432/agriintel
export DATABASE_URL=postgresql+psycopg://agri_app:agri_app@localhost:5432/agriintel
alembic upgrade head && python -m app.seed --superadmin admin@agriintel.local 'ChangeMe12345'
EMAIL_DEV_ECHO=true uvicorn app.main:app --reload

cd apps/web && npm install && npm run dev     # http://localhost:3000
```

## Tests

| Suite | Command | Result at hand-off |
|---|---|---|
| API (pytest, Postgres + mocked NASA responses) | `cd apps/api && pytest` (needs `agriintel_test` DB) | 31 passed |
| ML pipeline | `cd services/ml-models && pytest` | 1 passed |
| Web E2E (Playwright, API + web running) | `cd apps/web && npx playwright test` | 5 passed |
| Type check / build | `npx tsc --noEmit && npm run build` | clean |

## Implementation status (honest)

| Area | Status |
|---|---|
| Auth: register, login, refresh, logout-all, email verification, forgot/reset password, invitations | ✅ Working, tested |
| Multi-tenancy: org-scoped queries **and** PostgreSQL RLS with a restricted DB role | ✅ Working, tested at API and DB level |
| Roles (6 org roles + platform super admin), plan features, usage limits, audit logs, suspension | ✅ Working |
| NASA POWER daily / climatology / MERRA-2 soil wetness: client, retries, validation, caching, provenance | ✅ Working against recorded-format fixtures. **Not exercised live from the build sandbox** (outbound access to NASA was blocked); first live run is a deployment check |
| GPM IMERG / SMAP: CMR granule discovery + job tracking | 🟡 Discovery implemented; download + HDF5 raster processing not yet built |
| Sentinel-2 NDVI | 🔴 Not configured; UI shows "unavailable" (no fabricated values) |
| Crop suitability (transparent rules model, explanations) | ✅ Working; crop parameters are **indicative defaults** awaiting agronomist review |
| Profitability calculator, saved scenarios | ✅ Working |
| Decision Simulator + PDF report | ✅ Working, tested end-to-end |
| Risk engine (climate / production / market, configurable) | ✅ Working; labelled decision-support |
| Market intelligence: CSV import (UI + n8n), summaries | ✅ Working; no price data shipped (never invented) |
| Yield prediction | 🟡 Training pipeline with held-out evaluation built; no real training data loaded, so predictions are disabled in the app |
| Satellite map: districts, farm drawing, area, GeoJSON import/export, layer catalogue, rainfall time-series playback, district panel | ✅ Working; district **polygons** need an official boundary file (points used now) |
| Raster layers (IMERG, SMAP, NDVI, flood, elevation) | 🔴 Shown as unavailable until processing exists |
| 3D landing page: WebGL globe, Sri Lanka highlight, satellites, links, scroll camera, static fallback | ✅ Working (3D agricultural landscape scene not built) |
| Public pages, pricing from admin-configurable plans, contact/demo forms | ✅ Working |
| Industry dashboards | 🟡 Shared overview with industry-specific focus and landing routes; dedicated portfolio-exposure views pending |
| Admin dashboard: stats, plans/pricing, customers, jobs, errors, enquiries, announcements | ✅ Working |
| n8n: 8 workflows, authenticated server-to-server, idempotent | 🟡 JSON generated and structurally validated; not yet imported into a live n8n instance |
| LLM assistant | 🔴 Not started (config placeholder only) |

See `docs/continuation.md` for the exact next steps.

Climate data: *These data were obtained from the NASA Langley Research Center (LaRC) POWER Project funded through the NASA Earth Science/Applied Science Program.* Sentinel-2 is an EU Copernicus mission, not a NASA mission.
