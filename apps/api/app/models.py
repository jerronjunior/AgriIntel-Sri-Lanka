"""SQLAlchemy ORM models.

Tenant-scoped tables carry `org_id` and are protected by PostgreSQL Row Level Security
(alembic revision 0002). When PostGIS is installed, revision 0003 adds a `geom` column to
`farm_boundaries` populated from `geojson` by trigger, with a GIST spatial index.
"""
import uuid
from datetime import UTC, date, datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Index,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

JSONType = JSON().with_variant(JSONB(), "postgresql")


def uid() -> uuid.UUID:
    return uuid.uuid4()


def now() -> datetime:
    return datetime.now(UTC)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now, nullable=False)


# ---------------------------------------------------------------- identity & tenancy
class User(TimestampMixin, Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(200), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_superadmin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    token_version: Mapped[int] = mapped_column(Integer, default=0, nullable=False)  # bump to revoke all tokens
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    memberships: Mapped[list["OrganizationMember"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class UserToken(Base):
    """Single-use email verification / password reset / invitation tokens (hashed)."""
    __tablename__ = "user_tokens"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    purpose: Mapped[str] = mapped_column(String(30), nullable=False)  # verify_email | reset_password | invite
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    payload: Mapped[dict | None] = mapped_column(JSONType)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Organization(TimestampMixin, Base):
    __tablename__ = "organizations"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    industry: Mapped[str] = mapped_column(String(40), nullable=False)  # farm|insurance|banking|agribusiness|government
    country: Mapped[str] = mapped_column(String(2), default="LK")
    status: Mapped[str] = mapped_column(String(20), default="active")  # active | suspended
    settings: Mapped[dict] = mapped_column(JSONType, default=dict)
    members: Mapped[list["OrganizationMember"]] = relationship(back_populates="organization", cascade="all, delete-orphan")


class Role(Base):
    __tablename__ = "roles"
    key: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    permissions: Mapped[list] = mapped_column(JSONType, default=list)


class OrganizationMember(TimestampMixin, Base):
    __tablename__ = "organization_members"
    __table_args__ = (UniqueConstraint("org_id", "user_id"),)
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(ForeignKey("roles.key"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active")
    organization: Mapped[Organization] = relationship(back_populates="members")
    user: Mapped[User] = relationship(back_populates="memberships")


class SubscriptionPlan(TimestampMixin, Base):
    """Prices are intentionally nullable: they are configured by platform admins, never hard-coded."""
    __tablename__ = "subscription_plans"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    key: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    audience: Mapped[str] = mapped_column(String(40), default="")
    price_amount: Mapped[float | None] = mapped_column(Numeric(12, 2))
    price_currency: Mapped[str | None] = mapped_column(String(3))
    billing_period: Mapped[str | None] = mapped_column(String(20))
    features: Mapped[list] = mapped_column(JSONType, default=list)
    limits: Mapped[dict] = mapped_column(JSONType, default=dict)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Subscription(TimestampMixin, Base):
    __tablename__ = "subscriptions"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), unique=True)
    plan_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("subscription_plans.id"))
    status: Mapped[str] = mapped_column(String(20), default="trial")  # trial|active|past_due|suspended|cancelled
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    plan: Mapped[SubscriptionPlan] = relationship()


# ---------------------------------------------------------------- farms & geography
class Farm(TimestampMixin, Base):
    __tablename__ = "farms"
    __table_args__ = (UniqueConstraint("org_id", "name"),)
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    district: Mapped[str] = mapped_column(String(60), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    area_ha: Mapped[float | None] = mapped_column(Float)
    irrigation: Mapped[str] = mapped_column(String(20), default="none")  # none | partial | full
    notes: Mapped[str] = mapped_column(Text, default="")
    boundary: Mapped["FarmBoundary | None"] = relationship(back_populates="farm", uselist=False, cascade="all, delete-orphan")


class FarmBoundary(TimestampMixin, Base):
    __tablename__ = "farm_boundaries"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    farm_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("farms.id", ondelete="CASCADE"), unique=True)
    geojson: Mapped[dict] = mapped_column(JSONType, nullable=False)  # GeoJSON Polygon/MultiPolygon (EPSG:4326)
    area_ha: Mapped[float] = mapped_column(Float, nullable=False)
    farm: Mapped[Farm] = relationship(back_populates="boundary")


# ---------------------------------------------------------------- crops
class CropCatalog(Base):
    __tablename__ = "crop_catalog"
    key: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    local_name: Mapped[str] = mapped_column(String(80), default="")
    category: Mapped[str] = mapped_column(String(40), default="")


class CropRequirement(TimestampMixin, Base):
    __tablename__ = "crop_requirements"
    crop_key: Mapped[str] = mapped_column(ForeignKey("crop_catalog.key", ondelete="CASCADE"), primary_key=True)
    params: Mapped[dict] = mapped_column(JSONType, nullable=False)  # see app/data/crops.py
    source_note: Mapped[str] = mapped_column(Text, default="")
    reviewed: Mapped[bool] = mapped_column(Boolean, default=False)


class CropCalendar(Base):
    __tablename__ = "crop_calendars"
    __table_args__ = (UniqueConstraint("crop_key", "season"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    crop_key: Mapped[str] = mapped_column(ForeignKey("crop_catalog.key", ondelete="CASCADE"))
    season: Mapped[str] = mapped_column(String(10))  # maha | yala
    sowing_months: Mapped[list] = mapped_column(JSONType, default=list)
    note: Mapped[str] = mapped_column(Text, default="")


# ---------------------------------------------------------------- earth observation
class SatelliteDataSource(TimestampMixin, Base):
    __tablename__ = "satellite_data_sources"
    key: Mapped[str] = mapped_column(String(60), primary_key=True)
    provider: Mapped[str] = mapped_column(String(120), nullable=False)
    mission: Mapped[str] = mapped_column(String(120), default="")
    product: Mapped[str] = mapped_column(String(200), nullable=False)
    spatial_resolution: Mapped[str] = mapped_column(String(120), default="")
    temporal_resolution: Mapped[str] = mapped_column(String(80), default="")
    access_method: Mapped[str] = mapped_column(String(200), default="")
    requires_credentials: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(30), default="not_configured")  # operational|degraded|not_configured|pending_implementation
    last_success_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str | None] = mapped_column(Text)
    url: Mapped[str] = mapped_column(String(300), default="")


class SatelliteObservation(Base):
    """Granule-level metadata discovered via NASA CMR or other catalogs."""
    __tablename__ = "satellite_observations"
    __table_args__ = (UniqueConstraint("source_key", "granule_id"),)
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    source_key: Mapped[str] = mapped_column(ForeignKey("satellite_data_sources.key"))
    granule_id: Mapped[str] = mapped_column(String(300))
    time_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    time_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    download_url: Mapped[str | None] = mapped_column(Text)
    processing_status: Mapped[str] = mapped_column(String(30), default="discovered")
    meta: Mapped[dict] = mapped_column(JSONType, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ClimateObservation(Base):
    """Daily point observations (NASA POWER). Keyed on the queried point, rounded to 0.01°."""
    __tablename__ = "climate_observations"
    __table_args__ = (UniqueConstraint("source_key", "lat", "lon", "obs_date"), Index("ix_climate_point_date", "lat", "lon", "obs_date"))
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_key: Mapped[str] = mapped_column(ForeignKey("satellite_data_sources.key"))
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lon: Mapped[float] = mapped_column(Float, nullable=False)
    obs_date: Mapped[date] = mapped_column(Date, nullable=False)
    t2m: Mapped[float | None] = mapped_column(Float)
    t2m_max: Mapped[float | None] = mapped_column(Float)
    t2m_min: Mapped[float | None] = mapped_column(Float)
    rh2m: Mapped[float | None] = mapped_column(Float)
    precip_mm: Mapped[float | None] = mapped_column(Float)
    solar_kwh_m2: Mapped[float | None] = mapped_column(Float)
    wind_ms: Mapped[float | None] = mapped_column(Float)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class SoilMoistureObservation(Base):
    __tablename__ = "soil_moisture_observations"
    __table_args__ = (UniqueConstraint("source_key", "lat", "lon", "obs_date"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_key: Mapped[str] = mapped_column(ForeignKey("satellite_data_sources.key"))
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    obs_date: Mapped[date] = mapped_column(Date)
    surface: Mapped[float | None] = mapped_column(Float)
    root_zone: Mapped[float | None] = mapped_column(Float)
    units: Mapped[str] = mapped_column(String(40), default="")
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class VegetationObservation(Base):
    __tablename__ = "vegetation_observations"
    __table_args__ = (UniqueConstraint("source_key", "farm_id", "obs_date"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    source_key: Mapped[str] = mapped_column(ForeignKey("satellite_data_sources.key"))
    farm_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("farms.id", ondelete="CASCADE"))
    obs_date: Mapped[date] = mapped_column(Date)
    ndvi_mean: Mapped[float | None] = mapped_column(Float)
    cloud_cover_pct: Mapped[float | None] = mapped_column(Float)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


# ---------------------------------------------------------------- market
class MarketPrice(Base):
    __tablename__ = "market_prices"
    __table_args__ = (UniqueConstraint("commodity", "market", "price_date", "price_type", "source"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    commodity: Mapped[str] = mapped_column(String(60), index=True)
    market: Mapped[str] = mapped_column(String(100))
    district: Mapped[str | None] = mapped_column(String(60))
    price_date: Mapped[date] = mapped_column(Date, index=True)
    price_type: Mapped[str] = mapped_column(String(20), default="wholesale")  # wholesale | retail | farmgate
    price_lkr_per_kg: Mapped[float] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String(200))
    imported_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


# ---------------------------------------------------------------- intelligence outputs (tenant scoped)
class CropRecommendation(Base):
    __tablename__ = "crop_recommendations"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    farm_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("farms.id", ondelete="SET NULL"))
    district: Mapped[str] = mapped_column(String(60))
    season: Mapped[str] = mapped_column(String(10))
    inputs: Mapped[dict] = mapped_column(JSONType)
    result: Mapped[dict] = mapped_column(JSONType)
    model_version: Mapped[str] = mapped_column(String(40))
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class YieldPrediction(Base):
    __tablename__ = "yield_predictions"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    farm_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("farms.id", ondelete="SET NULL"))
    crop_key: Mapped[str] = mapped_column(ForeignKey("crop_catalog.key"))
    season: Mapped[str] = mapped_column(String(10))
    model_name: Mapped[str] = mapped_column(String(80))
    model_version: Mapped[str] = mapped_column(String(40))
    yield_t_per_ha: Mapped[float | None] = mapped_column(Float)
    lower_t_per_ha: Mapped[float | None] = mapped_column(Float)
    upper_t_per_ha: Mapped[float | None] = mapped_column(Float)
    inputs: Mapped[dict] = mapped_column(JSONType, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class MLModelRegistry(Base):
    __tablename__ = "ml_models"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String(80))
    version: Mapped[str] = mapped_column(String(40))
    task: Mapped[str] = mapped_column(String(40))  # yield | price
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft | evaluated | published | retired
    metrics: Mapped[dict | None] = mapped_column(JSONType)  # only populated from held-out evaluation
    training_data: Mapped[dict] = mapped_column(JSONType, default=dict)
    artifact_uri: Mapped[str | None] = mapped_column(String(400))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ProfitabilityScenario(TimestampMixin, Base):
    __tablename__ = "profitability_scenarios"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    farm_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("farms.id", ondelete="SET NULL"))
    assumptions: Mapped[dict] = mapped_column(JSONType)
    result: Mapped[dict] = mapped_column(JSONType)
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))


class RiskAssessment(Base):
    __tablename__ = "risk_assessments"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    farm_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("farms.id", ondelete="SET NULL"))
    district: Mapped[str] = mapped_column(String(60))
    inputs: Mapped[dict] = mapped_column(JSONType)
    result: Mapped[dict] = mapped_column(JSONType)
    method_version: Mapped[str] = mapped_column(String(40))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class SimulationResult(Base):
    __tablename__ = "simulation_results"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    inputs: Mapped[dict] = mapped_column(JSONType)
    result: Mapped[dict] = mapped_column(JSONType)
    engine_version: Mapped[str] = mapped_column(String(40))
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Report(Base):
    __tablename__ = "reports"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(40))
    title: Mapped[str] = mapped_column(String(200))
    ref_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    status: Mapped[str] = mapped_column(String(20), default="ready")
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(40))
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text, default="")
    severity: Mapped[str] = mapped_column(String(20), default="info")
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    emailed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    dedupe_key: Mapped[str | None] = mapped_column(String(200), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


# ---------------------------------------------------------------- platform ops
class AutomationJob(Base):
    __tablename__ = "automation_jobs"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    kind: Mapped[str] = mapped_column(String(60), index=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(200), unique=True)
    status: Mapped[str] = mapped_column(String(20), default="queued")  # queued|running|succeeded|failed
    progress: Mapped[int] = mapped_column(Integer, default=0)
    triggered_by: Mapped[str] = mapped_column(String(40), default="api")  # api | n8n | celery | admin
    params: Mapped[dict] = mapped_column(JSONType, default=dict)
    result: Mapped[dict | None] = mapped_column(JSONType)
    error: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("organizations.id", ondelete="SET NULL"), index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    action: Mapped[str] = mapped_column(String(80))
    target_type: Mapped[str | None] = mapped_column(String(60))
    target_id: Mapped[str | None] = mapped_column(String(80))
    meta: Mapped[dict] = mapped_column(JSONType, default=dict)
    ip: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)


class Announcement(Base):
    __tablename__ = "announcements"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ContactRequest(Base):
    __tablename__ = "contact_requests"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    kind: Mapped[str] = mapped_column(String(20))  # contact | demo | subscription
    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(320))
    organization: Mapped[str] = mapped_column(String(200), default="")
    industry: Mapped[str] = mapped_column(String(40), default="")
    plan_key: Mapped[str | None] = mapped_column(String(40))
    message: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="new")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


TENANT_TABLES = [
    "farms", "farm_boundaries", "crop_recommendations", "yield_predictions",
    "profitability_scenarios", "risk_assessments", "simulation_results", "reports", "notifications",
]
