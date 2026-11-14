import re
import uuid
from datetime import UTC, datetime, timedelta

import jwt
from fastapi import APIRouter, Depends, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import (create_access_token, create_refresh_token, decode_token, hash_password,
                               new_opaque_token, sha256, verify_password)
from app.db import get_db
from app.deps import api_error, client_ip, current_user
from app.models import Organization, OrganizationMember, Subscription, SubscriptionPlan, User, UserToken
from app.rate_limit import limiter
from app.schemas import (AcceptInviteIn, EmailIn, LoginIn, MeOut, MembershipOut, RefreshIn, RegisterIn,
                         ResetPasswordIn, TokenIn, TokenOut)
from app.services.common import audit, send_email

router = APIRouter(prefix="/auth", tags=["auth"])


def _tokens(user: User) -> TokenOut:
    s = get_settings()
    return TokenOut(access_token=create_access_token(str(user.id), user.token_version),
                    refresh_token=create_refresh_token(str(user.id), user.token_version),
                    expires_in=s.ACCESS_TOKEN_MINUTES * 60)


def _slugify(name: str, db: Session) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:60] or "org"
    slug, i = base, 1
    while db.query(Organization).filter_by(slug=slug).first():
        i += 1
        slug = f"{base}-{i}"
    return slug


def _issue_token(db: Session, user_id, purpose: str, hours: int, payload: dict | None = None) -> str:
    raw, h = new_opaque_token()
    db.add(UserToken(user_id=user_id, purpose=purpose, token_hash=h, payload=payload,
                     expires_at=datetime.now(UTC) + timedelta(hours=hours)))
    return raw


def _consume(db: Session, raw: str, purpose: str) -> UserToken:
    t = db.query(UserToken).filter_by(token_hash=sha256(raw), purpose=purpose).one_or_none()
    if not t or t.used_at or t.expires_at < datetime.now(UTC):
        raise api_error(400, "invalid_token", "Token is invalid or has expired")
    t.used_at = datetime.now(UTC)
    return t


def _dev(extra: dict) -> dict:
    return extra if get_settings().EMAIL_DEV_ECHO else {}


@router.post("/register", status_code=201)
@limiter.limit("5/minute")
def register(request: Request, body: RegisterIn, db: Session = Depends(get_db)):
    email = body.email.lower()
    if db.query(User).filter(func.lower(User.email) == email).first():
        raise api_error(409, "email_taken", "An account with this email already exists")
    plan = db.query(SubscriptionPlan).filter_by(key=body.plan_key).one_or_none()
    if not plan:
        raise api_error(400, "invalid_plan", "Unknown plan")
    user = User(email=email, full_name=body.full_name, password_hash=hash_password(body.password))
    org = Organization(name=body.organization_name, slug=_slugify(body.organization_name, db), industry=body.industry)
    db.add_all([user, org])
    db.flush()
    db.add(OrganizationMember(org_id=org.id, user_id=user.id, role="org_admin"))
    db.add(Subscription(org_id=org.id, plan_id=plan.id, status="trial", current_period_end=datetime.now(UTC) + timedelta(days=14)))
    raw = _issue_token(db, user.id, "verify_email", 48)
    audit(db, "auth.register", user_id=user.id, org_id=org.id, ip=client_ip(request))
    db.commit()
    send_email(user.email, "Verify your AgriIntel account",
               f"Welcome to AgriIntel.\n\nVerify your email: {get_settings().FRONTEND_URL}/verify-email?token={raw}\n")
    return {"user_id": str(user.id), "org_id": str(org.id), **_tokens(user).model_dump(), **_dev({"dev_verification_token": raw})}


@router.post("/login", response_model=TokenOut)
@limiter.limit("10/minute")
def login(request: Request, body: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(func.lower(User.email) == body.email.lower()).one_or_none()
    if not user or not verify_password(body.password, user.password_hash):
        audit(db, "auth.login_failed", meta={"email": body.email.lower()}, ip=client_ip(request))
        db.commit()
        raise api_error(401, "invalid_credentials", "Incorrect email or password")
    if not user.is_active:
        raise api_error(403, "account_suspended", "This account is suspended")
    user.last_login_at = datetime.now(UTC)
    audit(db, "auth.login", user_id=user.id, ip=client_ip(request))
    db.commit()
    return _tokens(user)


@router.post("/refresh", response_model=TokenOut)
@limiter.limit("30/minute")
def refresh(request: Request, body: RefreshIn, db: Session = Depends(get_db)):
    try:
        p = decode_token(body.refresh_token, "refresh")
        user = db.get(User, uuid.UUID(p["sub"]))
    except (jwt.PyJWTError, ValueError):
        raise api_error(401, "invalid_token", "Invalid refresh token")
    if not user or not user.is_active or p.get("tv") != user.token_version:
        raise api_error(401, "invalid_token", "Refresh token revoked")
    return _tokens(user)


@router.post("/logout-all", status_code=204)
def logout_all(user: User = Depends(current_user), db: Session = Depends(get_db)):
    user.token_version += 1
    db.commit()


@router.get("/me", response_model=MeOut)
def me(user: User = Depends(current_user), db: Session = Depends(get_db)):
    ms = []
    for m in db.query(OrganizationMember).filter_by(user_id=user.id, status="active").all():
        sub = db.query(Subscription).filter_by(org_id=m.org_id).one_or_none()
        ms.append(MembershipOut(org_id=m.org_id, org_name=m.organization.name, industry=m.organization.industry, role=m.role,
                                plan_key=sub.plan.key if sub else None, features=sub.plan.features if sub else [],
                                subscription_status=sub.status if sub else None))
    return MeOut(id=user.id, email=user.email, full_name=user.full_name, is_superadmin=user.is_superadmin,
                 email_verified=user.email_verified_at is not None, memberships=ms)


@router.post("/verify-email")
def verify_email(body: TokenIn, db: Session = Depends(get_db)):
    t = _consume(db, body.token, "verify_email")
    user = db.get(User, t.user_id)
    user.email_verified_at = datetime.now(UTC)
    db.commit()
    return {"verified": True}


@router.post("/resend-verification")
@limiter.limit("3/minute")
def resend_verification(request: Request, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if user.email_verified_at:
        return {"sent": False, "reason": "already verified"}
    raw = _issue_token(db, user.id, "verify_email", 48)
    db.commit()
    send_email(user.email, "Verify your AgriIntel account", f"{get_settings().FRONTEND_URL}/verify-email?token={raw}")
    return {"sent": True, **_dev({"dev_verification_token": raw})}


@router.post("/forgot-password")
@limiter.limit("3/minute")
def forgot_password(request: Request, body: EmailIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(func.lower(User.email) == body.email.lower()).one_or_none()
    extra = {}
    if user and user.is_active:
        raw = _issue_token(db, user.id, "reset_password", 1)
        audit(db, "auth.password_reset_requested", user_id=user.id, ip=client_ip(request))
        db.commit()
        send_email(user.email, "Reset your AgriIntel password",
                   f"Reset your password (valid 1 hour): {get_settings().FRONTEND_URL}/reset-password?token={raw}")
        extra = _dev({"dev_reset_token": raw})
    # Same response whether or not the account exists (no user enumeration).
    return {"message": "If an account exists for this email, a reset link has been sent.", **extra}


@router.post("/reset-password")
def reset_password(body: ResetPasswordIn, db: Session = Depends(get_db)):
    t = _consume(db, body.token, "reset_password")
    user = db.get(User, t.user_id)
    user.password_hash = hash_password(body.new_password)
    user.token_version += 1  # revoke existing sessions
    audit(db, "auth.password_reset", user_id=user.id)
    db.commit()
    return {"reset": True}


@router.post("/accept-invite", response_model=TokenOut)
def accept_invite(body: AcceptInviteIn, db: Session = Depends(get_db)):
    t = _consume(db, body.token, "invite")
    p = t.payload or {}
    user = db.query(User).filter(func.lower(User.email) == p["email"]).one_or_none()
    if not user:
        if not body.password or not body.full_name:
            db.rollback()
            raise api_error(400, "details_required", "full_name and password are required for new accounts")
        from app.schemas import _password_ok
        try:
            _password_ok(body.password)
        except ValueError as e:
            db.rollback()
            raise api_error(422, "weak_password", str(e))
        user = User(email=p["email"], full_name=body.full_name, password_hash=hash_password(body.password),
                    email_verified_at=datetime.now(UTC))
        db.add(user)
        db.flush()
    org_id = uuid.UUID(p["org_id"])
    if not db.query(OrganizationMember).filter_by(org_id=org_id, user_id=user.id).first():
        db.add(OrganizationMember(org_id=org_id, user_id=user.id, role=p["role"]))
    audit(db, "org.invite_accepted", user_id=user.id, org_id=org_id)
    db.commit()
    return _tokens(user)
