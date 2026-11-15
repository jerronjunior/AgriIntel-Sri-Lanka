"""Idempotent reference-data seed:  python -m app.seed  [--superadmin email password]"""
import sys

from sqlalchemy import text

from app.core.security import hash_password
from app.data.crops import CROPS, SEASONS, SOURCE_NOTE
from app.data.reference import DATA_SOURCES, PLANS, ROLES
from app.db import set_tenant
from app.models import (CropCalendar, CropCatalog, CropRequirement, Organization,
                        OrganizationMember, Role, SatelliteDataSource, Subscription,
                        SubscriptionPlan, User)


def seed(db) -> None:
    set_tenant(db, None, bypass=True)
    is_sqlite = bool(db.bind and db.bind.dialect.name == "sqlite")

    if is_sqlite:
        for key, r in ROLES.items():
            obj = db.get(Role, key)
            if not obj:
                db.add(Role(key=key, **r))
            else:
                for k, v in r.items():
                    setattr(obj, k, v)
        for p in PLANS:
            if not db.query(SubscriptionPlan).filter_by(key=p["key"]).first():
                db.add(SubscriptionPlan(**p))
        for src in DATA_SOURCES:
            obj = db.get(SatelliteDataSource, src["key"])
            if not obj:
                db.add(SatelliteDataSource(**src))
            else:
                for k, v in src.items():
                    if k not in ("key", "status"):
                        setattr(obj, k, v)
        for key, c in CROPS.items():
            if not db.get(CropCatalog, key):
                db.add(CropCatalog(key=key, name=c["name"], local_name=c["local_name"], category=c["category"]))
            params = {k: v for k, v in c.items() if k not in ("name", "local_name", "category")}
            if not db.query(CropRequirement).filter_by(crop_key=key).first():
                db.add(CropRequirement(crop_key=key, params=params, source_note=SOURCE_NOTE, reviewed=False))
            for season, s in SEASONS.items():
                if not db.query(CropCalendar).filter_by(crop_key=key, season=season).first():
                    db.add(CropCalendar(crop_key=key, season=season, sowing_months=s["months"][:2], note=s["note"]))
        db.commit()
    else:
        from sqlalchemy.dialects.postgresql import insert as pg_insert
        for key, r in ROLES.items():
            db.execute(pg_insert(Role).values(key=key, **r).on_conflict_do_update(index_elements=["key"], set_=r))
        for p in PLANS:
            # never overwrite admin-configured price fields
            db.execute(pg_insert(SubscriptionPlan).values(**p).on_conflict_do_nothing(index_elements=["key"]))
        for src in DATA_SOURCES:
            upd = {k: v for k, v in src.items() if k not in ("key", "status")}
            db.execute(pg_insert(SatelliteDataSource).values(**src).on_conflict_do_update(index_elements=["key"], set_=upd))
        for key, c in CROPS.items():
            db.execute(pg_insert(CropCatalog).values(key=key, name=c["name"], local_name=c["local_name"], category=c["category"])
                       .on_conflict_do_nothing(index_elements=["key"]))
            params = {k: v for k, v in c.items() if k not in ("name", "local_name", "category")}
            db.execute(pg_insert(CropRequirement).values(crop_key=key, params=params, source_note=SOURCE_NOTE, reviewed=False)
                       .on_conflict_do_nothing(index_elements=["crop_key"]))
            for season, s in SEASONS.items():
                db.execute(pg_insert(CropCalendar).values(crop_key=key, season=season, sowing_months=s["months"][:2], note=s["note"])
                           .on_conflict_do_nothing(index_elements=["crop_key", "season"]))
        db.commit()


def ensure_demo_users(db) -> None:
    # 1. Platform Admin
    admin = db.query(User).filter((User.email == "admin@agriintel.local") | (User.username == "admin")).first()
    if not admin:
        admin = User(
            email="admin@agriintel.local",
            username="admin",
            full_name="Platform Admin",
            password_hash=hash_password("ChangeMe12345"),
            is_superadmin=True,
            is_active=True,
        )
        db.add(admin)
        db.flush()

    # 2. Demo User (user01)
    u1 = db.query(User).filter((User.email == "user01@gmail.com") | (User.username == "user01")).first()
    if not u1:
        u1 = User(
            email="user01@gmail.com",
            username="user01",
            full_name="User 01",
            password_hash=hash_password("Password123!"),
            is_superadmin=False,
            is_active=True,
        )
        db.add(u1)
        db.flush()

    # 3. Demo Organization
    org = db.query(Organization).filter_by(slug="agriintel-demo").first()
    if not org:
        org = Organization(
            name="AgriIntel Demo Farm",
            slug="agriintel-demo",
            industry="enterprise_farming",
            country="LK",
        )
        db.add(org)
        db.flush()

    # 4. Memberships
    for user_obj, role_name in [(admin, "admin"), (u1, "farm_manager")]:
        mem = db.query(OrganizationMember).filter_by(org_id=org.id, user_id=user_obj.id).first()
        if not mem:
            db.add(OrganizationMember(org_id=org.id, user_id=user_obj.id, role=role_name, status="active"))

    # 5. Free / Enterprise Subscription for the demo org
    plan = db.query(SubscriptionPlan).first()
    if plan:
        sub = db.query(Subscription).filter_by(org_id=org.id).first()
        if not sub:
            db.add(Subscription(org_id=org.id, plan_id=plan.id, status="active"))

    db.commit()


def ensure_superadmin(db, email: str, password: str) -> None:
    u = db.query(User).filter_by(email=email.lower()).one_or_none()
    if not u:
        u = User(email=email.lower(), full_name="Platform Admin", password_hash=hash_password(password))
        db.add(u)
    u.is_superadmin = True
    db.commit()


if __name__ == "__main__":
    from app.db import SessionLocal
    db = SessionLocal()
    seed(db)
    ensure_demo_users(db)
    if len(sys.argv) >= 4 and sys.argv[1] == "--superadmin":
        ensure_superadmin(db, sys.argv[2], sys.argv[3])
    print("seed complete")
    db.execute(text("SELECT 1"))
    db.close()
