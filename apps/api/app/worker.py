"""Celery worker + beat schedule (production alternative to n8n-triggered jobs).

Run:  celery -A app.worker worker -l info   and   celery -A app.worker beat -l info
"""
from celery import Celery
from celery.schedules import crontab

from app.core.config import get_settings
from app.db import SessionLocal, set_tenant
from app.services import jobs

broker = get_settings().REDIS_URL or "redis://localhost:6379/0"
celery_app = Celery("agriintel", broker=broker, backend=broker)
celery_app.conf.update(task_acks_late=True, worker_prefetch_multiplier=1, timezone="Asia/Colombo")
celery_app.conf.beat_schedule = {
    "power-daily-sync": {"task": "app.worker.run_job", "schedule": crontab(hour=6, minute=17), "args": ("sync_power_daily", {"days": 10})},
    "risk-alerts": {"task": "app.worker.run_job", "schedule": crontab(hour=7, minute=13), "args": ("risk_alerts", {})},
    "weekly-report": {"task": "app.worker.run_job", "schedule": crontab(day_of_week=1, hour=8, minute=7), "args": ("weekly_report", {})},
}


@celery_app.task(bind=True, autoretry_for=(ConnectionError,), retry_backoff=True, max_retries=3)
def run_job(self, kind: str, params: dict, idempotency_key: str | None = None):
    db = SessionLocal()
    set_tenant(db, None, bypass=True)
    job, created = jobs.create_job(db, kind, params, "celery", idempotency_key)
    db.close()
    if created:
        jobs.execute(job.id)
    return str(job.id)
