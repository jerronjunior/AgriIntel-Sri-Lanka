# Architecture

```
Browser (Next.js on Vercel)
  │  Bearer JWT + X-Org-Id header
  ▼
FastAPI (Azure Container Apps)  ── /api/v1/*  (OpenAPI at /api/v1/docs)
  │  deps.py: current_user → org_context (membership, role, plan) → require(permission, feature)
  │  db.set_tenant(): SET app.current_org_id   → PostgreSQL RLS policies (defense in depth)
  ├── services/nasa_power.py   NASA POWER client (retries, validation, -999 → null, DB cache, provenance)
  ├── services/earthdata.py    NASA CMR discovery for GPM IMERG / SMAP
  ├── services/crop_engine.py  rules-based suitability (trapezoid membership + law of the minimum)
  ├── services/simulator.py    scenario engine (FAO-33 Ky water response × thermal factor)
  ├── services/risk.py         transparent risk index, missing components excluded
  ├── services/jobs.py         background jobs (BackgroundTasks / Celery / n8n), idempotency keys
  └── services/pdf_report.py   ReportLab scenario reports
PostgreSQL 16 + PostGIS ── tenant tables with RLS; geometry column + GIST index when PostGIS present
Redis ── rate-limit storage, Celery broker
n8n ── schedules → POST /automation/run with X-Automation-Key
```

## Data classes
Every API response that carries data states its class, and the UI renders a tag:
**Observed / Historical** (NASA POWER), **Simulated** (scenarios, profitability), **Predicted** (only from evaluated
models — none published yet), **Demo** (illustrations on the marketing site only).

## Database
Migrations live in `apps/api/alembic/versions` (`database/migrations` points there):
`0001` schema (all tables from the brief), `0002` RLS + restricted `agri_app` role, `0003` PostGIS geometry (skipped if
PostGIS is absent), `0004` notification email tracking. Reference data seeding: `python -m app.seed`.
