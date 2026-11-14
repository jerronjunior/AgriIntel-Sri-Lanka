import logging
from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings

logger = logging.getLogger("app.db")


class Base(DeclarativeBase):
    pass


def _init_engine():
    db_url = get_settings().DATABASE_URL
    if db_url.startswith("sqlite"):
        return create_engine(db_url, connect_args={"check_same_thread": False}, future=True)

    try:
        # Probe PostgreSQL connection with a fast 2-second timeout
        probe_engine = create_engine(db_url, connect_args={"connect_timeout": 2}, pool_pre_ping=True, future=True)
        with probe_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Successfully connected to PostgreSQL database.")
        return probe_engine
    except Exception as exc:
        logger.warning(
            "PostgreSQL is unreachable (%s). Initializing resilient local SQLite database...", exc
        )
        sqlite_path = Path(__file__).resolve().parent.parent / "agriintel_dev.db"
        return create_engine(
            f"sqlite:///{sqlite_path.as_posix()}",
            connect_args={"check_same_thread": False},
            future=True,
        )


engine = _init_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        # Clear tenant context for PostgreSQL so pooled connections never leak another org's RLS setting.
        try:
            db.rollback()
            if db.bind and db.bind.dialect.name == "postgresql":
                db.execute(text("RESET app.current_org_id"))
                db.execute(text("RESET app.bypass_rls"))
                db.commit()
        except Exception:
            pass
        db.close()


def set_tenant(db: Session, org_id: str | None, bypass: bool = False) -> None:
    """Session-level settings consumed by the Row Level Security policies (see alembic 0002)."""
    if db.bind and db.bind.dialect.name == "postgresql":
        db.execute(text("SELECT set_config('app.current_org_id', :v, false)"), {"v": org_id or ""})
        db.execute(text("SELECT set_config('app.bypass_rls', :v, false)"), {"v": "on" if bypass else "off"})


def _bootstrap_sqlite_if_needed():
    if engine.dialect.name == "sqlite":
        try:
            import app.models  # ensure models are loaded into Base.metadata
            Base.metadata.create_all(bind=engine)
            from app.seed import ensure_demo_users, seed
            with SessionLocal() as session:
                seed(session)
                ensure_demo_users(session)
            logger.info("Local SQLite database initialized with crops, roles, and demo accounts (admin, user01).")
        except Exception as seed_err:
            logger.error("Failed to seed local SQLite database: %s", seed_err)


_bootstrap_sqlite_if_needed()
