"""Request dependencies: authentication, tenant context, RBAC and plan entitlements.

Authorization is enforced here (backend) AND by PostgreSQL RLS (database). The frontend only
hides menus for convenience.
"""
import hmac
import uuid
from dataclasses import dataclass

import jwt
from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import decode_token
from app.db import get_db, set_tenant
from app.models import Organization, OrganizationMember, Role, Subscription, User

bearer = HTTPBearer(auto_error=False)


def api_error(code: int, error: str, message: str) -> HTTPException:
    return HTTPException(status_code=code, detail={"error": error, "message": message})


def current_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)) -> User:
    if not creds:
        raise api_error(401, "unauthenticated", "Missing bearer token")
    try:
        payload = decode_token(creds.credentials, "access")
        user = db.get(User, uuid.UUID(payload["sub"]))
    except (jwt.PyJWTError, ValueError):
        raise api_error(401, "invalid_token", "Invalid or expired token")
    if not user or not user.is_active or payload.get("tv") != user.token_version:
        raise api_error(401, "invalid_token", "Token revoked or account disabled")
    return user


def superadmin(user: User = Depends(current_user), db: Session = Depends(get_db)) -> User:
    if not user.is_superadmin:
        raise api_error(403, "forbidden", "Platform super admin only")
    set_tenant(db, None, bypass=True)
    return user


@dataclass
class OrgContext:
    user: User
    org: Organization
    role: str
    permissions: set[str]
    plan_key: str | None
    features: set[str]
    limits: dict
    subscription_status: str | None

    def can(self, perm: str) -> bool:
        return perm in self.permissions


def org_context(
    x_org_id: str | None = Header(default=None, alias="X-Org-Id"),
    user: User = Depends(current_user), db: Session = Depends(get_db),
) -> OrgContext:
    if not x_org_id:
        raise api_error(400, "org_required", "X-Org-Id header is required")
    try:
        org_uuid = uuid.UUID(x_org_id)
    except ValueError:
        raise api_error(400, "org_invalid", "X-Org-Id must be a UUID")
    m = db.query(OrganizationMember).filter_by(org_id=org_uuid, user_id=user.id, status="active").one_or_none()
    org = db.get(Organization, org_uuid)
    if not org or (not m and not user.is_superadmin):
        raise api_error(403, "forbidden", "Not a member of this organization")
    if org.status != "active" and not user.is_superadmin:
        raise api_error(403, "org_suspended", "This organization is suspended")
    role = m.role if m else "org_admin"
    perms = set(db.get(Role, role).permissions) if db.get(Role, role) else set()
    sub = db.query(Subscription).filter_by(org_id=org.id).one_or_none()
    set_tenant(db, str(org.id))
    return OrgContext(user=user, org=org, role=role, permissions=perms,
                      plan_key=sub.plan.key if sub else None,
                      features=set(sub.plan.features) if sub and sub.status in ("trial", "active") else set(),
                      limits=sub.plan.limits if sub else {}, subscription_status=sub.status if sub else None)


def require(perm: str, feature: str | None = None):
    def dep(ctx: OrgContext = Depends(org_context)) -> OrgContext:
        if not ctx.can(perm):
            raise api_error(403, "forbidden", f"Your role ({ctx.role}) lacks permission '{perm}'")
        if feature and feature not in ctx.features and not ctx.user.is_superadmin:
            raise api_error(402, "feature_not_in_plan", f"Feature '{feature}' is not included in your subscription")
        return ctx
    return dep


def automation_key(x_automation_key: str | None = Header(default=None, alias="X-Automation-Key"), db: Session = Depends(get_db)) -> Session:
    expected = get_settings().AUTOMATION_API_KEY
    if not expected or not x_automation_key or not hmac.compare_digest(expected, x_automation_key):
        raise api_error(401, "invalid_automation_key", "Invalid automation key")
    set_tenant(db, None, bypass=True)
    return db


def client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None
