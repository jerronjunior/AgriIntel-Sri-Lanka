"""Public plans/contact, subscriptions, usage, notifications, reports and dashboard overview."""
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.data.reference import FEATURES
from app.db import get_db
from app.deps import OrgContext, api_error, org_context, require
from app.models import (ContactRequest, CropRecommendation, Farm, MarketPrice, Notification, OrganizationMember, Report,
                        SatelliteDataSource, SimulationResult, Subscription, SubscriptionPlan, Announcement)
from app.rate_limit import limiter
from app.schemas import ContactIn, PlanOut
from app.services.common import send_email
from app.core.config import get_settings

router = APIRouter(tags=["saas"])


@router.get("/subscriptions/plans", response_model=dict)
def public_plans(db: Session = Depends(get_db)):
    plans = db.query(SubscriptionPlan).filter_by(is_public=True).order_by(SubscriptionPlan.sort_order).all()
    return {"items": [PlanOut.model_validate(p).model_dump(mode="json") for p in plans], "features": FEATURES,
            "pricing_note": "Prices are configured by the platform administrator. Plans without a price are quoted on request."}


@router.get("/subscriptions/current")
def current_subscription(ctx: OrgContext = Depends(org_context), db: Session = Depends(get_db)):
    sub = db.query(Subscription).filter_by(org_id=ctx.org.id).one_or_none()
    if not sub:
        return {"subscription": None}
    return {"subscription": {"status": sub.status, "plan": PlanOut.model_validate(sub.plan).model_dump(mode="json"),
                             "current_period_end": sub.current_period_end}}


@router.get("/usage")
def usage(ctx: OrgContext = Depends(org_context), db: Session = Depends(get_db)):
    first = datetime.now(UTC).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return {
        "farms": {"used": db.query(func.count(Farm.id)).filter_by(org_id=ctx.org.id).scalar(), "limit": ctx.limits.get("max_farms")},
        "users": {"used": db.query(func.count(OrganizationMember.id)).filter_by(org_id=ctx.org.id).scalar(), "limit": ctx.limits.get("max_users")},
        "simulations_this_month": {"used": db.query(func.count(SimulationResult.id)).filter(SimulationResult.org_id == ctx.org.id,
                                                                                             SimulationResult.created_at >= first).scalar(),
                                   "limit": ctx.limits.get("max_simulations_per_month")},
    }


@router.post("/contact", status_code=201)
@limiter.limit("5/minute")
def contact(request: Request, body: ContactIn, db: Session = Depends(get_db)):
    c = ContactRequest(**body.model_dump(exclude={"website"}))
    db.add(c)
    db.commit()
    send_email(get_settings().SMTP_FROM, f"[AgriIntel] New {body.kind} request from {body.organization or body.name}",
               f"{body.name} <{body.email}>\nIndustry: {body.industry}\nPlan: {body.plan_key}\n\n{body.message}")
    return {"received": True, "id": str(c.id)}


@router.get("/notifications")
def notifications(ctx: OrgContext = Depends(org_context), db: Session = Depends(get_db)):
    rows = (db.query(Notification).filter(Notification.org_id == ctx.org.id)
            .filter((Notification.user_id.is_(None)) | (Notification.user_id == ctx.user.id))
            .order_by(Notification.created_at.desc()).limit(50).all())
    ann = db.query(Announcement).filter_by(active=True).order_by(Announcement.created_at.desc()).limit(5).all()
    return {"items": [{"id": str(n.id), "kind": n.kind, "title": n.title, "body": n.body, "severity": n.severity,
                       "read": n.read_at is not None, "created_at": n.created_at} for n in rows],
            "unread": sum(1 for n in rows if not n.read_at),
            "announcements": [{"title": a.title, "body": a.body, "created_at": a.created_at} for a in ann]}


@router.post("/notifications/{nid}/read", status_code=204)
def mark_read(nid: uuid.UUID, ctx: OrgContext = Depends(org_context), db: Session = Depends(get_db)):
    n = db.query(Notification).filter_by(id=nid, org_id=ctx.org.id).one_or_none()
    if not n:
        raise api_error(404, "not_found", "Notification not found")
    n.read_at = datetime.now(UTC)
    db.commit()


@router.get("/reports")
def reports(ctx: OrgContext = Depends(require("intel:read")), db: Session = Depends(get_db)):
    rows = db.query(Report).filter_by(org_id=ctx.org.id).order_by(Report.created_at.desc()).limit(100).all()
    return {"items": [{"id": str(r.id), "kind": r.kind, "title": r.title, "ref_id": str(r.ref_id) if r.ref_id else None,
                       "created_at": r.created_at} for r in rows]}


@router.get("/dashboard/overview")
def overview(ctx: OrgContext = Depends(require("intel:read")), db: Session = Depends(get_db)):
    farms = db.query(Farm).filter_by(org_id=ctx.org.id).all()
    latest_rec = db.query(CropRecommendation).filter_by(org_id=ctx.org.id).order_by(CropRecommendation.created_at.desc()).first()
    sources = db.query(SatelliteDataSource).all()
    return {
        "farms": {"count": len(farms), "hectares": round(sum(f.area_ha or 0 for f in farms), 2),
                  "with_boundary": sum(1 for f in farms if f.area_ha), "districts": sorted({f.district for f in farms})},
        "simulations": db.query(func.count(SimulationResult.id)).filter_by(org_id=ctx.org.id).scalar(),
        "latest_recommendation": {"district": latest_rec.district, "season": latest_rec.season,
                                  "recommended": latest_rec.result.get("recommended"), "created_at": latest_rec.created_at} if latest_rec else None,
        "market": {"commodities": db.query(func.count(func.distinct(MarketPrice.commodity))).scalar(),
                   "last_import_at": db.query(func.max(MarketPrice.imported_at)).scalar()},
        "data_sources": [{"key": s.key, "product": s.product, "status": s.status, "last_success_at": s.last_success_at} for s in sources],
        "note": "Metrics are computed from your organization's records. Climate metrics load per district from NASA POWER.",
    }
