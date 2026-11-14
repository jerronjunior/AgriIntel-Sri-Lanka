import re
import uuid
from datetime import date, datetime
from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

T = TypeVar("T")
Industry = Literal["farm", "insurance", "banking", "agribusiness", "government"]
OrgRole = Literal["org_admin", "farm_manager", "insurance_analyst", "banking_analyst", "government_analyst", "viewer"]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


def _password_ok(v: str) -> str:
    if len(v) < 10 or not re.search(r"[A-Za-z]", v) or not re.search(r"\d", v):
        raise ValueError("password must be ≥10 characters and include letters and numbers")
    return v


# ------------------------------------------------------------ auth
class RegisterIn(BaseModel):
    full_name: str = Field(min_length=2, max_length=200)
    email: EmailStr
    username: str | None = Field(default=None, min_length=2, max_length=50)
    password: str
    organization_name: str = Field(min_length=2, max_length=200)
    industry: Industry
    plan_key: str = "farm"
    _pw = field_validator("password")(_password_ok)


class LoginIn(BaseModel):
    username_or_email: str | None = None
    email: str | None = None
    username: str | None = None
    password: str

    @property
    def identifier(self) -> str:
        return (self.username_or_email or self.username or self.email or "").strip()


class FirebaseSessionIn(BaseModel):
    id_token: str = Field(min_length=20)


class FirebaseRegisterIn(RegisterIn):
    id_token: str = Field(min_length=20)


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshIn(BaseModel):
    refresh_token: str


class EmailIn(BaseModel):
    email: EmailStr


class TokenIn(BaseModel):
    token: str = Field(min_length=10, max_length=200)


class ResetPasswordIn(TokenIn):
    new_password: str
    _pw = field_validator("new_password")(_password_ok)


class AcceptInviteIn(TokenIn):
    full_name: str | None = Field(default=None, max_length=200)
    password: str | None = None


class MembershipOut(BaseModel):
    org_id: uuid.UUID
    org_name: str
    industry: str
    role: str
    plan_key: str | None
    features: list[str]
    subscription_status: str | None


class MeOut(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    is_superadmin: bool
    email_verified: bool
    memberships: list[MembershipOut]


# ------------------------------------------------------------ orgs
class OrgOut(ORM):
    id: uuid.UUID
    name: str
    slug: str
    industry: str
    status: str
    settings: dict


class OrgUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    settings: dict | None = None


class MemberOut(BaseModel):
    user_id: uuid.UUID
    email: str
    full_name: str
    role: str
    status: str


class InviteIn(BaseModel):
    email: EmailStr
    role: OrgRole


class RoleUpdate(BaseModel):
    role: OrgRole


# ------------------------------------------------------------ farms
class FarmIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    district: str
    latitude: float | None = Field(default=None, ge=5.7, le=10.0)
    longitude: float | None = Field(default=None, ge=79.4, le=82.1)
    irrigation: Literal["none", "partial", "full"] = "none"
    notes: str = Field(default="", max_length=2000)
    boundary: dict | None = None


class FarmOut(ORM):
    id: uuid.UUID
    name: str
    district: str
    latitude: float
    longitude: float
    area_ha: float | None
    irrigation: str
    notes: str
    created_at: datetime
    boundary_geojson: dict | None = None


# ------------------------------------------------------------ plans
class PlanOut(ORM):
    id: uuid.UUID
    key: str
    name: str
    description: str
    audience: str
    price_amount: float | None
    price_currency: str | None
    billing_period: str | None
    features: list[str]
    limits: dict
    is_public: bool
    sort_order: int


class PlanUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    audience: str | None = None
    price_amount: float | None = Field(default=None, ge=0)
    price_currency: str | None = Field(default=None, min_length=3, max_length=3)
    billing_period: Literal["monthly", "annual", "custom"] | None = None
    features: list[str] | None = None
    limits: dict | None = None
    is_public: bool | None = None


class ContactIn(BaseModel):
    kind: Literal["contact", "demo", "subscription"] = "contact"
    name: str = Field(min_length=2, max_length=200)
    email: EmailStr
    organization: str = Field(default="", max_length=200)
    industry: str = Field(default="", max_length=40)
    plan_key: str | None = None
    message: str = Field(default="", max_length=5000)
    website: str = Field(default="", max_length=0, description="honeypot — must be empty")


# ------------------------------------------------------------ intelligence
class RecommendIn(BaseModel):
    district: str
    season: Literal["maha", "yala"]
    irrigation: Literal["none", "partial", "full"] = "none"
    farm_id: uuid.UUID | None = None
    mean_temp_c: float | None = Field(default=None, ge=-5, le=45)
    rainfall_mm: float | None = Field(default=None, ge=0, le=6000)
    elevation_m: float | None = Field(default=None, ge=0, le=2600)
    soil_moisture_root: float | None = Field(default=None, ge=0, le=1)
    crops: list[str] | None = None


class MarketPriceOut(ORM):
    commodity: str
    market: str
    district: str | None
    price_date: date
    price_type: str
    price_lkr_per_kg: float
    source: str
    imported_at: datetime
