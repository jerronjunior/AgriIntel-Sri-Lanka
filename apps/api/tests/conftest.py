import os
import subprocess
import sys

OWNER_URL = os.environ.get("TEST_OWNER_DATABASE_URL", "postgresql+psycopg://agri:agri@localhost:5432/agriintel_test")
APP_URL = os.environ.get("TEST_DATABASE_URL", "postgresql+psycopg://agri_app:agri_app@localhost:5432/agriintel_test")
os.environ.update({"DATABASE_URL": APP_URL, "ENV": "test", "EMAIL_DEV_ECHO": "true", "AUTOMATION_API_KEY": "test-automation-key",
                   "JWT_SECRET": "test-secret-test-secret-test-secret-123", "HTTP_MAX_RETRIES": "2"})

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402

HERE = os.path.dirname(os.path.dirname(__file__))
TABLES_TO_CLEAR = ["audit_logs", "notifications", "reports", "simulation_results", "risk_assessments", "profitability_scenarios",
                   "yield_predictions", "crop_recommendations", "farm_boundaries", "farms", "market_prices", "user_tokens",
                   "subscriptions", "organization_members", "organizations", "users", "contact_requests", "automation_jobs",
                   "climate_observations", "soil_moisture_observations", "announcements"]


@pytest.fixture(scope="session", autouse=True)
def migrated():
    env = {**os.environ, "MIGRATION_DATABASE_URL": OWNER_URL}
    subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], cwd=HERE, env=env, check=True, capture_output=True)
    from app.db import SessionLocal
    from app.seed import seed
    db = SessionLocal()
    seed(db)
    db.close()
    yield


@pytest.fixture(autouse=True)
def clean():
    eng = create_engine(OWNER_URL)
    with eng.begin() as c:
        c.execute(text(f"TRUNCATE {', '.join(TABLES_TO_CLEAR)} RESTART IDENTITY CASCADE"))
        c.execute(text("UPDATE satellite_data_sources SET status = CASE WHEN key LIKE 'nasa_power%' THEN 'operational' ELSE status END, last_error = NULL"))
    eng.dispose()
    yield


@pytest.fixture
def client():
    from app.main import app
    return TestClient(app)


def register(client, email="a@example.com", org="Org A", industry="farm", plan="farm"):
    r = client.post("/api/v1/auth/register", json={"full_name": "Test User", "email": email, "password": "Password123",
                                                   "organization_name": org, "industry": industry, "plan_key": plan})
    assert r.status_code == 201, r.text
    d = r.json()
    return {"Authorization": f"Bearer {d['access_token']}", "X-Org-Id": d["org_id"]}, d


@pytest.fixture
def owner_engine():
    eng = create_engine(OWNER_URL)
    yield eng
    eng.dispose()
