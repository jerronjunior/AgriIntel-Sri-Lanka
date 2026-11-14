"""Platform super-admin dashboard API."""
import uuid

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import api_error, superadmin
from app.models import (Announcement, AuditLog, AutomationJob, ContactRequest, CropRequirement, MLModelRegistry, Organization,
                        OrganizationMember, SatelliteDataSource, SimulationResult, Subscription, SubscriptionPlan, User, Farm)
from app.schemas import PlanOut, PlanUpdate
from app.services.common import audit

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats")
def stats(admin: User = Depends(superadmin), db: Session = Depends(get_db)):
    subs = db.query(SubscriptionPlan.key, Subscription.status, func.count(Subscription.id)).join(SubscriptionPlan).group_by(SubscriptionPlan.key, Subscription.status).all()
    return {
        "organizations": db.query(func.count(Organization.id)).scalar(),
        "active_users": db.query(func.count(User.id)).filter_by(is_active=True).scalar(),
        "farms": db.query(func.count(Farm.id)).scalar(),
        "simulations": db.query(func.count(SimulationResult.id)).scalar(),
        "subscriptions": [{"plan": p, "status": s, "count": c} for p, s, c in subs],
        "data_sources": [{"key": s.key, "status": s.status, "last_success_at": s.last_success_at, "last_error": s.last_error}
                         for s in db.query(SatelliteDataSource).all()],
        "jobs": {st: c for st, c in db.query(AutomationJob.status, func.count(AutomationJob.id)).group_by(AutomationJob.status)},
        "models": [{"name": m.name, "version": m.version, "status": m.status} for m in db.query(MLModelRegistry).all()],
        "open_contact_requests": db.query(func.count(ContactRequest.id)).filter_by(status="new").scalar(),
    }


@router.get("/organizations")
def orgs(admin: User = Depends(superadmin), db: Session = Depends(get_db)):
    rows = db.query(Organization).order_by(Organization.created_at.desc()).all()
    out = []
    for o in rows:
        sub = db.query(Subscription).filter_by(org_id=o.id).one_or_none()
        out.append({"id": str(o.id), "name": o.name, "industry": o.industry, "status": o.status, "created_at": o.created_at,
                    "members": db.query(func.count(OrganizationMember.id)).filter_by(org_id=o.id).scalar(),
                    "plan": sub.plan.key if sub else None, "subscription_status": sub.status if sub else None})
    return {"items": out}


class OrgAdminUpdate(BaseModel):
    status: str | None = Field(default=None, pattern="^(active|suspended)$")
    plan_key: str | None = None
    subscription_status: str | None = Field(default=None, pattern="^(trial|active|past_due|suspended|cancelled)$")


@router.patch("/organizations/{org_id}")
def update_org(org_id: uuid.UUID, body: OrgAdminUpdate, admin: User = Depends(superadmin), db: Session = Depends(get_db)):
    o = db.get(Organization, org_id)
    if not o:
        raise api_error(404, "not_found", "Organization not found")
    if body.status:
        o.status = body.status
    sub = db.query(Subscription).filter_by(org_id=o.id).one_or_none()
    if body.plan_key:
        plan = db.query(SubscriptionPlan).filter_by(key=body.plan_key).one_or_none()
        if not plan:
            raise api_error(400, "invalid_plan", "Unknown plan")
        if sub:
            sub.plan_id = plan.id
        else:
            sub = Subscription(org_id=o.id, plan_id=plan.id, status="active")
            db.add(sub)
    if body.subscription_status and sub:
        sub.status = body.subscription_status
    audit(db, "admin.org_updated", user_id=admin.id, org_id=o.id, meta=body.model_dump(exclude_none=True))
    db.commit()
    return {"id": str(o.id), "status": o.status}


@router.patch("/users/{user_id}")
def update_user(user_id: uuid.UUID, is_active: bool, admin: User = Depends(superadmin), db: Session = Depends(get_db)):
    u = db.get(User, user_id)
    if not u:
        raise api_error(404, "not_found", "User not found")
    u.is_active = is_active
    if not is_active:
        u.token_version += 1
    audit(db, "admin.user_updated", user_id=admin.id, target_type="user", target_id=user_id, meta={"is_active": is_active})
    db.commit()
    return {"id": str(u.id), "is_active": u.is_active}


@router.get("/plans")
def plans(admin: User = Depends(superadmin), db: Session = Depends(get_db)):
    return {"items": [PlanOut.model_validate(p).model_dump(mode="json") for p in db.query(SubscriptionPlan).order_by(SubscriptionPlan.sort_order)]}


@router.patch("/plans/{key}")
def update_plan(key: str, body: PlanUpdate, admin: User = Depends(superadmin), db: Session = Depends(get_db)):
    p = db.query(SubscriptionPlan).filter_by(key=key).one_or_none()
    if not p:
        raise api_error(404, "not_found", "Plan not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    audit(db, "admin.plan_updated", user_id=admin.id, target_type="plan", target_id=key, meta=body.model_dump(mode="json", exclude_unset=True))
    db.commit()
    return PlanOut.model_validate(p)


@router.patch("/crop-requirements/{crop_key}")
def update_crop(crop_key: str, params: dict, reviewed: bool = False, admin: User = Depends(superadmin), db: Session = Depends(get_db)):
    r = db.get(CropRequirement, crop_key)
    if not r:
        raise api_error(404, "not_found", "Crop not found")
    required = {"temp_opt", "temp_abs", "water_mm", "water_abs_min_mm", "elev_max_m"}
    merged = {**r.params, **params}
    if not required <= merged.keys():
        raise api_error(422, "invalid_params", f"Missing keys {required - merged.keys()}")
    r.params, r.reviewed = merged, reviewed
    audit(db, "admin.crop_params_updated", user_id=admin.id, target_type="crop", target_id=crop_key, meta={"reviewed": reviewed})
    db.commit()
    return {"crop": crop_key, "params": r.params, "reviewed": r.reviewed}


@router.get("/jobs")
def jobs(limit: int = Query(50, le=500), admin: User = Depends(superadmin), db: Session = Depends(get_db)):
    rows = db.query(AutomationJob).order_by(AutomationJob.created_at.desc()).limit(limit).all()
    return {"items": [{"id": str(j.id), "kind": j.kind, "status": j.status, "progress": j.progress, "triggered_by": j.triggered_by,
                       "error": j.error, "result": j.result, "created_at": j.created_at, "finished_at": j.finished_at} for j in rows]}


@router.get("/errors")
def errors(admin: User = Depends(superadmin), db: Session = Depends(get_db)):
    failed = db.query(AutomationJob).filter_by(status="failed").order_by(AutomationJob.created_at.desc()).limit(50).all()
    sources = db.query(SatelliteDataSource).filter(SatelliteDataSource.last_error.isnot(None)).all()
    return {"jobs": [{"kind": j.kind, "error": j.error, "at": j.finished_at} for j in failed],
            "data_sources": [{"key": s.key, "error": s.last_error} for s in sources]}


@router.get("/audit-logs")
def audit_logs(limit: int = Query(100, le=1000), admin: User = Depends(superadmin), db: Session = Depends(get_db)):
    rows = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()
    return {"items": [{"action": r.action, "org_id": str(r.org_id) if r.org_id else None, "user_id": str(r.user_id) if r.user_id else None,
                       "meta": r.meta, "ip": r.ip, "created_at": r.created_at} for r in rows]}


@router.get("/contact-requests")
def contact_requests(admin: User = Depends(superadmin), db: Session = Depends(get_db)):
    rows = db.query(ContactRequest).order_by(ContactRequest.created_at.desc()).limit(200).all()
    return {"items": [{"id": str(c.id), "kind": c.kind, "name": c.name, "email": c.email, "organization": c.organization,
                       "industry": c.industry, "plan_key": c.plan_key, "message": c.message, "status": c.status, "created_at": c.created_at} for c in rows]}


class AnnouncementIn(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    body: str = Field(min_length=1, max_length=5000)


@router.post("/announcements", status_code=201)
def announce(body: AnnouncementIn, admin: User = Depends(superadmin), db: Session = Depends(get_db)):
    a = Announcement(title=body.title, body=body.body)
    db.add(a)
    db.commit()
    return {"id": str(a.id)}
