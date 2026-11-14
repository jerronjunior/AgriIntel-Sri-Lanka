from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings

engine = create_engine(get_settings().DATABASE_URL, pool_pre_ping=True, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        # Clear tenant context so pooled connections never leak another org's RLS setting.
        try:
            db.rollback()
            db.execute(text("RESET app.current_org_id"))
            db.execute(text("RESET app.bypass_rls"))
            db.commit()
        except Exception:
            pass
        db.close()


def set_tenant(db: Session, org_id: str | None, bypass: bool = False) -> None:
    """Session-level settings consumed by the Row Level Security policies (see alembic 0002)."""
    db.execute(text("SELECT set_config('app.current_org_id', :v, false)"), {"v": org_id or ""})
    db.execute(text("SELECT set_config('app.bypass_rls', :v, false)"), {"v": "on" if bypass else "off"})
