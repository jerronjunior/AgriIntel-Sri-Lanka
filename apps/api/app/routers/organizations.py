import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import new_opaque_token
from app.db import get_db
from app.deps import OrgContext, api_error, client_ip, org_context, require
from app.models import AuditLog, OrganizationMember, User, UserToken
from app.schemas import InviteIn, MemberOut, OrgOut, OrgUpdate, RoleUpdate
from app.services.common import audit, send_email

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("/current", response_model=OrgOut)
def current(ctx: OrgContext = Depends(org_context)):
    return ctx.org


@router.get("/current/context")
def context(ctx: OrgContext = Depends(org_context)):
    return {"org_id": str(ctx.org.id), "role": ctx.role, "permissions": sorted(ctx.permissions), "plan_key": ctx.plan_key,
            "features": sorted(ctx.features), "limits": ctx.limits, "subscription_status": ctx.subscription_status}


@router.patch("/current", response_model=OrgOut)
def update(body: OrgUpdate, request: Request, ctx: OrgContext = Depends(require("org:manage")), db: Session = Depends(get_db)):
    if body.name:
        ctx.org.name = body.name
    if body.settings is not None:
        ctx.org.settings = body.settings
    audit(db, "org.updated", user_id=ctx.user.id, org_id=ctx.org.id, ip=client_ip(request))
    db.commit()
    return ctx.org


@router.get("/current/members", response_model=list[MemberOut])
def members(ctx: OrgContext = Depends(require("org:read")), db: Session = Depends(get_db)):
    rows = db.query(OrganizationMember).filter_by(org_id=ctx.org.id).all()
    return [MemberOut(user_id=m.user_id, email=m.user.email, full_name=m.user.full_name, role=m.role, status=m.status) for m in rows]


@router.post("/current/invitations", status_code=201)
def invite(body: InviteIn, request: Request, ctx: OrgContext = Depends(require("members:manage")), db: Session = Depends(get_db)):
    max_users = (ctx.limits or {}).get("max_users")
    count = db.query(func.count(OrganizationMember.id)).filter_by(org_id=ctx.org.id).scalar()
    if max_users is not None and count >= max_users:
        raise api_error(402, "limit_reached", f"Your plan allows {max_users} users")
    raw, h = new_opaque_token()
    db.add(UserToken(purpose="invite", token_hash=h, expires_at=datetime.now(UTC) + timedelta(days=7),
                     payload={"email": body.email.lower(), "org_id": str(ctx.org.id), "role": body.role}))
    audit(db, "org.member_invited", user_id=ctx.user.id, org_id=ctx.org.id, meta={"email": body.email, "role": body.role}, ip=client_ip(request))
    db.commit()
    send_email(body.email, f"You're invited to {ctx.org.name} on AgriIntel",
               f"Accept the invitation: {get_settings().FRONTEND_URL}/accept-invite?token={raw}")
    return {"invited": body.email, **({"dev_invite_token": raw} if get_settings().EMAIL_DEV_ECHO else {})}


@router.patch("/current/members/{user_id}")
def change_role(user_id: uuid.UUID, body: RoleUpdate, ctx: OrgContext = Depends(require("members:manage")), db: Session = Depends(get_db)):
    m = db.query(OrganizationMember).filter_by(org_id=ctx.org.id, user_id=user_id).one_or_none()
    if not m:
        raise api_error(404, "not_found", "Member not found")
    if m.role == "org_admin" and body.role != "org_admin":
        admins = db.query(func.count(OrganizationMember.id)).filter_by(org_id=ctx.org.id, role="org_admin", status="active").scalar()
        if admins <= 1:
            raise api_error(400, "last_admin", "An organization must keep at least one admin")
    m.role = body.role
    audit(db, "org.member_role_changed", user_id=ctx.user.id, org_id=ctx.org.id, target_type="user", target_id=user_id, meta={"role": body.role})
    db.commit()
    return {"user_id": str(user_id), "role": m.role}


@router.delete("/current/members/{user_id}", status_code=204)
def remove(user_id: uuid.UUID, ctx: OrgContext = Depends(require("members:manage")), db: Session = Depends(get_db)):
    if user_id == ctx.user.id:
        raise api_error(400, "cannot_remove_self", "You cannot remove yourself")
    m = db.query(OrganizationMember).filter_by(org_id=ctx.org.id, user_id=user_id).one_or_none()
    if not m:
        raise api_error(404, "not_found", "Member not found")
    db.delete(m)
    audit(db, "org.member_removed", user_id=ctx.user.id, org_id=ctx.org.id, target_type="user", target_id=user_id)
    db.commit()


@router.get("/current/audit-logs")
def audit_logs(page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200),
               ctx: OrgContext = Depends(require("audit:read")), db: Session = Depends(get_db)):
    q = db.query(AuditLog).filter_by(org_id=ctx.org.id)
    total = q.count()
    rows = q.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    users = {u.id: u.email for u in db.query(User).filter(User.id.in_({r.user_id for r in rows if r.user_id})).all()}
    return {"items": [{"action": r.action, "user": users.get(r.user_id), "target_type": r.target_type, "target_id": r.target_id,
                       "meta": r.meta, "created_at": r.created_at} for r in rows], "total": total, "page": page, "page_size": page_size}
