"""PostGIS geometry for farm boundaries (applied only when the postgis extension is available).

Adds farm_boundaries.geom (MultiPolygon, SRID 4326) kept in sync with the GeoJSON column by trigger,
plus a GIST spatial index. On plain PostgreSQL (no PostGIS) this migration is a no-op and the
application falls back to Shapely/pyproj for geometry operations.

Revision ID: 0003
Revises: 0002
"""
from alembic import op
from sqlalchemy import text

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def _has_postgis() -> bool:
    bind = op.get_bind()
    return bool(bind.execute(text("SELECT 1 FROM pg_available_extensions WHERE name = 'postgis'")).scalar())


def upgrade() -> None:
    if not _has_postgis():
        print("PostGIS not available — skipping geometry column (Shapely fallback in use)")
        return
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.execute("ALTER TABLE farm_boundaries ADD COLUMN IF NOT EXISTS geom geometry(MultiPolygon, 4326)")
    op.execute("""
    CREATE OR REPLACE FUNCTION farm_boundary_sync_geom() RETURNS trigger AS $$
    BEGIN
      NEW.geom := ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(NEW.geojson::text), 4326));
      RETURN NEW;
    END; $$ LANGUAGE plpgsql;
    """)
    op.execute("DROP TRIGGER IF EXISTS trg_farm_boundary_geom ON farm_boundaries")
    op.execute("CREATE TRIGGER trg_farm_boundary_geom BEFORE INSERT OR UPDATE OF geojson ON farm_boundaries "
               "FOR EACH ROW EXECUTE FUNCTION farm_boundary_sync_geom()")
    op.execute("UPDATE farm_boundaries SET geojson = geojson")
    op.execute("CREATE INDEX IF NOT EXISTS ix_farm_boundaries_geom ON farm_boundaries USING GIST (geom)")


def downgrade() -> None:
    if not _has_postgis():
        return
    op.execute("DROP TRIGGER IF EXISTS trg_farm_boundary_geom ON farm_boundaries")
    op.execute("DROP FUNCTION IF EXISTS farm_boundary_sync_geom()")
    op.execute("ALTER TABLE farm_boundaries DROP COLUMN IF EXISTS geom")
