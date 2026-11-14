"""Background jobs, shared by FastAPI BackgroundTasks, Celery workers and n8n-triggered runs.

Each job is tracked in `automation_jobs`; an idempotency key prevents duplicate runs
(e.g. n8n retries) for the same logical period.
"""
import logging
import traceback
from datetime import UTC, date, datetime, timedelta

from sqlalchemy.orm import Session

from app.data.reference import DISTRICTS
from app.db import SessionLocal, set_tenant
from app.models import AutomationJob, Farm, Notification, Organization, OrganizationMember, User
from app.services import earthdata, nasa_power, risk
from app.services.common import send_email

log = logging.getLogger("agriintel.jobs")


def create_job(db: Session, kind: str, params: dict, triggered_by: str, idempotency_key: str | None) -> tuple[AutomationJob, bool]:
    if idempotency_key:
        existing = db.query(AutomationJob).filter_by(idempotency_key=idempotency_key).one_or_none()
        if existing and existing.status != "failed":
            return existing, False
        if existing:  # allow retry of failed run
            existing.status, existing.error, existing.progress = "queued", None, 0
            db.commit()
            return existing, True
    job = AutomationJob(kind=kind, params=params, triggered_by=triggered_by, idempotency_key=idempotency_key)
    db.add(job)
    db.commit()
    return job, True


def execute(job_id) -> None:
    db = SessionLocal()
    set_tenant(db, None, bypass=True)
    job = db.get(AutomationJob, job_id)
    job.status, job.started_at = "running", datetime.now(UTC)
    db.commit()
    try:
        fn = JOBS[job.kind]
        job.result = fn(db, job, **(job.params or {}))
        job.status, job.progress = "succeeded", 100
    except Exception as e:
        db.rollback()
        job = db.get(AutomationJob, job_id)
        job.status, job.error = "failed", f"{e}\n{traceback.format_exc()[-1500:]}"
        log.exception("job %s failed", job_id)
    job.finished_at = datetime.now(UTC)
    db.commit()
    db.close()


def _progress(db: Session, job: AutomationJob, i: int, n: int) -> None:
    job.progress = int(i / n * 100)
    db.commit()


def sync_power_daily(db: Session, job: AutomationJob, days: int = 10) -> dict:
    start, end = nasa_power.default_range(days)
    ok, failed = 0, []
    for i, d in enumerate(DISTRICTS, 1):
        try:
            nasa_power.get_daily_cached(db, d["lat"], d["lon"], start, end)
            nasa_power.get_soil_wetness_cached(db, d["lat"], d["lon"], start, end)
            ok += 1
        except Exception as e:
            db.rollback()
            failed.append({"district": d["name"], "error": str(e)[:200]})
        _progress(db, job, i, len(DISTRICTS))
    if failed and not ok:
        raise RuntimeError(f"All districts failed, e.g. {failed[0]}")
    return {"start": str(start), "end": str(end), "districts_ok": ok, "failed": failed}


def discover_granules(db: Session, job: AutomationJob, product: str = "gpm_imerg_final", days: int = 7) -> dict:
    end = date.today()
    granules = earthdata.search_granules(product, end - timedelta(days=days), end)
    return {"product": product, "found": len(granules), "new": earthdata.store_granules(db, product, granules)}


def risk_alerts(db: Session, job: AutomationJob, threshold_pct: float = -40.0, days: int = 30) -> dict:
    """Notify orgs that have farms in districts with a significant rainfall deficit (vs. 2001–2020 normal)."""
    start, end = nasa_power.default_range(days)
    by_district: dict[str, list[Farm]] = {}
    for f in db.query(Farm).all():
        by_district.setdefault(f.district, []).append(f)
    alerts = 0
    for name, farms in by_district.items():
        d = next(x for x in DISTRICTS if x["name"] == name)
        rows, _ = nasa_power.get_daily_cached(db, d["lat"], d["lon"], start, end)
        clim = nasa_power.fetch_climatology(d["lat"], d["lon"])
        observed = sum(r.precip_mm or 0 for r in rows)
        normal = sum(clim["PRECTOTCORR"][(start + timedelta(days=k)).month] or 0 for k in range((end - start).days + 1))
        anomaly = risk.rainfall_anomaly_pct(observed, normal)
        if anomaly is None or anomaly > threshold_pct:
            continue
        for org_id in {f.org_id for f in farms}:
            key = f"rain-deficit:{org_id}:{name}:{end.isoformat()}"
            if db.query(Notification).filter_by(dedupe_key=key).first():
                continue
            db.add(Notification(org_id=org_id, kind="risk_alert", severity="warning", dedupe_key=key,
                                title=f"Rainfall deficit in {name}",
                                body=f"{days}-day rainfall to {end} was {observed:.0f} mm vs ~{normal:.0f} mm normal ({anomaly:+.0f}%). "
                                     "Source: NASA POWER. Decision-support alert."))
            alerts += 1
    db.commit()
    return {"alerts_created": alerts, "window": [str(start), str(end)]}


def weekly_report(db: Session, job: AutomationJob) -> dict:
    sent = 0
    for org in db.query(Organization).filter_by(status="active").all():
        admins = (db.query(User).join(OrganizationMember, OrganizationMember.user_id == User.id)
                  .filter(OrganizationMember.org_id == org.id, OrganizationMember.role == "org_admin").all())
        n_farms = db.query(Farm).filter_by(org_id=org.id).count()
        alerts = db.query(Notification).filter(Notification.org_id == org.id,
                                               Notification.created_at >= datetime.now(UTC) - timedelta(days=7)).count()
        for a in admins:
            send_email(a.email, f"AgriIntel weekly intelligence — {org.name}",
                       f"Farms monitored: {n_farms}\nAlerts this week: {alerts}\n\nOpen your dashboard for details.")
            sent += 1
    return {"emails": sent}


def email_notifications(db: Session, job: AutomationJob) -> dict:
    """Email each org's un-emailed alerts to its admins once (emailed_at makes this idempotent)."""
    pending = db.query(Notification).filter(Notification.emailed_at.is_(None)).order_by(Notification.created_at).limit(500).all()
    by_org: dict = {}
    for n in pending:
        by_org.setdefault(n.org_id, []).append(n)
    sent = 0
    for org_id, items in by_org.items():
        admins = (db.query(User).join(OrganizationMember, OrganizationMember.user_id == User.id)
                  .filter(OrganizationMember.org_id == org_id, OrganizationMember.role == "org_admin", User.is_active.is_(True)).all())
        body = "\n\n".join(f"{n.title}\n{n.body}" for n in items)
        for a in admins:
            send_email(a.email, f"AgriIntel: {len(items)} new alert(s)", body)
            sent += 1
        for n in items:
            n.emailed_at = datetime.now(UTC)
        db.commit()
    return {"notifications": len(pending), "emails": sent}


JOBS = {"sync_power_daily": sync_power_daily, "discover_granules": discover_granules,
        "risk_alerts": risk_alerts, "weekly_report": weekly_report,
        "email_notifications": email_notifications}
