"""Idempotent reference-data seed:  python -m app.seed  [--superadmin email password]"""
import sys

from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.security import hash_password
from app.data.crops import CROPS, SEASONS, SOURCE_NOTE
from app.data.reference import DATA_SOURCES, PLANS, ROLES
from app.db import SessionLocal, set_tenant
from app.models import CropCalendar, CropCatalog, CropRequirement, Role, SatelliteDataSource, SubscriptionPlan, User


def seed(db) -> None:
    set_tenant(db, None, bypass=True)
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


def ensure_superadmin(db, email: str, password: str) -> None:
    u = db.query(User).filter_by(email=email.lower()).one_or_none()
    if not u:
        u = User(email=email.lower(), full_name="Platform Admin", password_hash=hash_password(password))
        db.add(u)
    u.is_superadmin = True
    db.commit()


if __name__ == "__main__":
    db = SessionLocal()
    seed(db)
    if len(sys.argv) >= 4 and sys.argv[1] == "--superadmin":
        ensure_superadmin(db, sys.argv[2], sys.argv[3])
    print("seed complete")
    db.execute(text("SELECT 1"))
    db.close()
