import os

from alembic import context
from sqlalchemy import create_engine

from app.db import Base
from app import models  # noqa: F401

# Migrations run as the schema OWNER (MIGRATION_DATABASE_URL); the API runs as a restricted role.
url = os.environ.get("MIGRATION_DATABASE_URL") or os.environ.get("DATABASE_URL")
target_metadata = Base.metadata


def run_migrations_online() -> None:
    engine = create_engine(url)
    with engine.connect() as conn:
        context.configure(connection=conn, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()


run_migrations_online()
