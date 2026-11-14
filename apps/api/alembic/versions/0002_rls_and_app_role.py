"""Row Level Security on tenant tables + restricted application role.

The API connects as `agri_app` (no superuser, no BYPASSRLS), so these policies apply to it.
Each request sets `app.current_org_id` (see app/db.py:set_tenant). Platform-admin and
automation code paths set `app.bypass_rls = on` explicitly.

Revision ID: 0002
Revises: 0001
"""
import os

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

TENANT_TABLES = ["farms", "farm_boundaries", "crop_recommendations", "yield_predictions", "profitability_scenarios",
                 "risk_assessments", "simulation_results", "reports", "notifications"]

POLICY = """
CREATE POLICY tenant_isolation ON {t}
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR org_id::text = nullif(current_setting('app.current_org_id', true), '')
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR org_id::text = nullif(current_setting('app.current_org_id', true), '')
  );
"""


def upgrade() -> None:
    app_pw = os.environ.get("APP_DB_PASSWORD", "agri_app")
    op.execute(f"""
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agri_app') THEN
        CREATE ROLE agri_app LOGIN PASSWORD '{app_pw}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
      END IF;
    END $$;
    """)
    op.execute("GRANT USAGE ON SCHEMA public TO agri_app")
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO agri_app")
    op.execute("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO agri_app")
    op.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO agri_app")
    op.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO agri_app")
    op.execute("REVOKE ALL ON alembic_version FROM agri_app")
    for t in TENANT_TABLES:
        op.execute(f"ALTER TABLE {t} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {t} FORCE ROW LEVEL SECURITY")
        op.execute(POLICY.format(t=t))


def downgrade() -> None:
    for t in TENANT_TABLES:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {t}")
        op.execute(f"ALTER TABLE {t} DISABLE ROW LEVEL SECURITY")
