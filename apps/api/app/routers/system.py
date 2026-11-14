"""Health, data-source catalog, job status and n8n automation endpoints."""
import uuid
from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, File, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import api_error, automation_key, current_user
from app.models import AutomationJob, SatelliteDataSource, User
from app.services import jobs, market_csv

router = APIRouter(tags=["system"])


@router.get("/health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False
    return {"status": "ok" if db_ok else "degraded", "database": db_ok}


@router.get("/data-sources")
def data_sources(db: Session = Depends(get_db)):
    rows = db.query(SatelliteDataSource).order_by(SatelliteDataSource.key).all()
    return {"items": [{"key": s.key, "provider": s.provider, "mission": s.mission, "product": s.product,
                       "spatial_resolution": s.spatial_resolution, "temporal_resolution": s.temporal_resolution,
                       "access_method": s.access_method, "requires_credentials": s.requires_credentials, "status": s.status,
                       "last_success_at": s.last_success_at, "url": s.url} for s in rows]}


@router.get("/jobs/{job_id}")
def job_status(job_id: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    j = db.get(AutomationJob, job_id)
    if not j or not user.is_superadmin:
        raise api_error(404, "not_found", "Job not found")
    return {"id": str(j.id), "kind": j.kind, "status": j.status, "progress": j.progress, "result": j.result, "error": j.error}


class AutomationRun(BaseModel):
    kind: Literal["sync_power_daily", "discover_granules", "risk_alerts", "weekly_report", "email_notifications"]
    params: dict = Field(default_factory=dict)
    idempotency_key: str | None = Field(default=None, max_length=200)
    wait: bool = False


@router.post("/automation/run", status_code=202)
def automation_run(body: AutomationRun, bg: BackgroundTasks, db: Session = Depends(automation_key)):
    """Called by n8n with header X-Automation-Key. Idempotent per idempotency_key."""
    job, created = jobs.create_job(db, body.kind, body.params, "n8n", body.idempotency_key)
    if created:
        if body.wait:
            jobs.execute(job.id)
            db.refresh(job)
        else:
            bg.add_task(jobs.execute, job.id)
    return {"job_id": str(job.id), "created": created, "status": job.status, "result": job.result if body.wait else None}


@router.get("/automation/jobs/{job_id}")
def automation_job(job_id: uuid.UUID, db: Session = Depends(automation_key)):
    j = db.get(AutomationJob, job_id)
    if not j:
        raise api_error(404, "not_found", "Job not found")
    return {"id": str(j.id), "kind": j.kind, "status": j.status, "progress": j.progress, "result": j.result, "error": j.error}


@router.post("/automation/market-import")
async def automation_market_import(file: UploadFile = File(...), db: Session = Depends(automation_key)):
    """n8n posts an official price CSV here (multipart field "file"). Upserts are idempotent."""
    raw = await file.read(market_csv.MAX_BYTES + 1)
    try:
        res = market_csv.import_csv(db, file.filename or "", raw)
    except market_csv.CsvError as e:
        raise api_error(e.status, e.code, str(e))
    db.commit()
    return res
