import io
import json
from pathlib import Path

import httpx
import respx
from sqlalchemy import text

from tests.conftest import APP_URL, register

FIX = Path(__file__).parent / "fixtures"
CLIM = json.loads((FIX / "power_climatology.json").read_text())
DAILY = json.loads((FIX / "power_daily.json").read_text())

SQUARE = {"type": "Polygon", "coordinates": [[[81.30, 6.85], [81.31, 6.85], [81.31, 6.86], [81.30, 6.86], [81.30, 6.85]]]}


def test_health(client):
    assert client.get("/api/v1/health").json()["database"] is True


def test_register_login_me_and_verify(client):
    h, d = register(client)
    me = client.get("/api/v1/auth/me", headers=h).json()
    assert me["email"] == "a@example.com" and me["email_verified"] is False
    assert me["memberships"][0]["role"] == "org_admin" and me["memberships"][0]["plan_key"] == "farm"
    assert client.post("/api/v1/auth/verify-email", json={"token": d["dev_verification_token"]}).status_code == 200
    assert client.get("/api/v1/auth/me", headers=h).json()["email_verified"] is True
    assert client.post("/api/v1/auth/verify-email", json={"token": d["dev_verification_token"]}).status_code == 400  # single use
    bad = client.post("/api/v1/auth/login", json={"email": "a@example.com", "password": "wrongpass1"})
    assert bad.status_code == 401 and bad.json()["error"] == "invalid_credentials"
    assert client.post("/api/v1/auth/login", json={"email": "A@example.com", "password": "Password123"}).status_code == 200


def test_weak_password_and_duplicate_email(client):
    r = client.post("/api/v1/auth/register", json={"full_name": "X Y", "email": "w@example.com", "password": "short",
                                                   "organization_name": "W", "industry": "farm"})
    assert r.status_code == 422 and r.json()["error"] == "validation_error"
    register(client, "dup@example.com")
    r = client.post("/api/v1/auth/register", json={"full_name": "X Y", "email": "dup@example.com", "password": "Password123",
                                                   "organization_name": "W2", "industry": "farm"})
    assert r.status_code == 409


def test_password_reset_revokes_tokens(client):
    h, _ = register(client)
    r = client.post("/api/v1/auth/forgot-password", json={"email": "a@example.com"}).json()
    unknown = client.post("/api/v1/auth/forgot-password", json={"email": "nobody@example.com"}).json()
    assert unknown["message"] == r["message"] and "dev_reset_token" not in unknown
    assert client.post("/api/v1/auth/reset-password", json={"token": r["dev_reset_token"], "new_password": "NewPassword456"}).status_code == 200
    assert client.get("/api/v1/auth/me", headers=h).status_code == 401
    assert client.post("/api/v1/auth/login", json={"email": "a@example.com", "password": "NewPassword456"}).status_code == 200


def test_farm_crud_area_and_geojson(client):
    h, _ = register(client)
    r = client.post("/api/v1/farms", headers=h, json={"name": "North field", "district": "monaragala", "boundary": SQUARE})
    assert r.status_code == 201, r.text
    f = r.json()
    assert f["district"] == "Monaragala"
    assert 120 < f["area_ha"] < 125  # ~1.1 km × 1.1 km at 6.85°N
    fc = client.get("/api/v1/farms/export.geojson", headers=h).json()
    assert fc["features"][0]["properties"]["name"] == "North field"
    fc["features"][0]["properties"]["name"] = "Imported copy"
    bad = {"type": "Feature", "properties": {"name": "Outside", "district": "Colombo"},
           "geometry": {"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 0]]]}}
    imp = client.post("/api/v1/farms/import.geojson", headers=h, json={"type": "FeatureCollection", "features": [fc["features"][0], bad]}).json()
    assert imp["created"] == 1 and len(imp["errors"]) == 1
    assert client.get("/api/v1/farms", headers=h).json()["total"] == 2
    assert client.delete(f"/api/v1/farms/{f['id']}", headers=h).status_code == 204


def test_tenant_isolation_api_and_rls(client, owner_engine):
    ha, _ = register(client, "a@example.com", "Org A")
    hb, _ = register(client, "b@example.com", "Org B")
    fa = client.post("/api/v1/farms", headers=ha, json={"name": "A farm", "district": "Ampara", "latitude": 7.3, "longitude": 81.6}).json()
    assert client.get(f"/api/v1/farms/{fa['id']}", headers=hb).status_code == 404
    assert client.get("/api/v1/farms", headers=hb).json()["total"] == 0
    # B cannot act inside A by swapping the org header
    assert client.get("/api/v1/farms", headers={**hb, "X-Org-Id": ha["X-Org-Id"]}).status_code == 403
    # Database-level: the restricted app role sees nothing without a tenant setting, and only its own org with one
    from sqlalchemy import create_engine
    eng = create_engine(APP_URL)
    with eng.connect() as c:
        assert c.execute(text("SELECT count(*) FROM farms")).scalar() == 0
        c.execute(text("SELECT set_config('app.current_org_id', :o, false)"), {"o": hb["X-Org-Id"]})
        assert c.execute(text("SELECT count(*) FROM farms")).scalar() == 0
        c.execute(text("SELECT set_config('app.current_org_id', :o, false)"), {"o": ha["X-Org-Id"]})
        assert c.execute(text("SELECT count(*) FROM farms")).scalar() == 1
    eng.dispose()


def test_rbac_viewer_cannot_write(client):
    h, _ = register(client)
    inv = client.post("/api/v1/organizations/current/invitations", headers=h, json={"email": "v@example.com", "role": "viewer"}).json()
    tok = client.post("/api/v1/auth/accept-invite", json={"token": inv["dev_invite_token"], "full_name": "Vee", "password": "Password123"}).json()
    hv = {"Authorization": f"Bearer {tok['access_token']}", "X-Org-Id": h["X-Org-Id"]}
    assert client.get("/api/v1/farms", headers=hv).status_code == 200
    r = client.post("/api/v1/farms", headers=hv, json={"name": "x", "district": "Ampara", "latitude": 7.3, "longitude": 81.6})
    assert r.status_code == 403 and r.json()["error"] == "forbidden"
    assert client.post("/api/v1/organizations/current/invitations", headers=hv, json={"email": "z@example.com", "role": "viewer"}).status_code == 403


def test_plan_entitlement_blocks_risk_for_farm_plan(client):
    h, _ = register(client, plan="farm")
    r = client.get("/api/v1/risk/district?district=Ampara", headers=h)
    assert r.status_code == 402 and r.json()["error"] == "feature_not_in_plan"


def test_simulation_with_nasa_baseline_and_pdf(client):
    h, _ = register(client)
    body = {"name": "Monaragala dry-season comparison", "district": "Monaragala", "season": "yala", "area_ha": 10,
            "rain_change_pct": -20, "irrigation": "none",
            "crops": [{"crop": c, "attainable_yield_t_per_ha": 1.2, "price_lkr_per_kg": 450,
                       "costs_per_ha": {"seed": 15000, "fertilizer": 25000, "labor": 90000}} for c in ("green_gram", "sesame", "groundnut")]}
    with respx.mock(base_url="https://power.larc.nasa.gov/api", assert_all_called=False) as m:
        m.get("/temporal/climatology/point").mock(return_value=httpx.Response(200, json=CLIM))
        r = client.post("/api/v1/simulations", headers=h, json=body)
    assert r.status_code == 200, r.text
    sim = r.json()
    assert "NASA POWER" in sim["climate"]["baseline"]["source"]
    assert len(sim["results"]) == 3 and sim["data_class"] == "simulated"
    pdf = client.get(f"/api/v1/simulations/{sim['id']}/report.pdf", headers=h)
    assert pdf.status_code == 200 and pdf.content[:4] == b"%PDF"
    assert client.get("/api/v1/reports", headers=h).json()["items"][0]["kind"] == "simulation_pdf"


def test_simulation_upstream_failure_is_explicit(client):
    h, _ = register(client)
    body = {"district": "Ampara", "season": "maha", "area_ha": 1,
            "crops": [{"crop": "paddy", "attainable_yield_t_per_ha": 4, "price_lkr_per_kg": 120}]}
    with respx.mock(base_url="https://power.larc.nasa.gov/api") as m:
        m.get("/temporal/climatology/point").mock(return_value=httpx.Response(500, headers={"Retry-After": "0.01"}))
        r = client.post("/api/v1/simulations", headers=h, json=body)
    assert r.status_code == 503 and r.json()["error"] == "upstream_unavailable"
    src = client.get("/api/v1/data-sources").json()["items"]
    assert next(s for s in src if s["key"] == "nasa_power_climatology")["status"] == "degraded"


def test_climate_daily_is_cached(client):
    h, _ = register(client)
    with respx.mock(base_url="https://power.larc.nasa.gov/api") as m:
        route = m.get("/temporal/daily/point").mock(return_value=httpx.Response(200, json=DAILY))
        q = "/api/v1/climate/daily?lat=6.87&lon=81.35&start=2024-01-01&end=2024-01-10"
        r1 = client.get(q, headers=h).json()
        r2 = client.get(q, headers=h).json()
    assert route.call_count == 1
    assert r1["provenance"]["cache_hit"] is False and r2["provenance"]["cache_hit"] is True
    assert r1["summary"]["heavy_rain_days_50mm"] == 1 and r1["summary"]["missing_days"] == 1
    assert r1["provenance"]["spatial_resolution"].startswith("0.5°")


def test_market_csv_import_and_summary(client):
    h, _ = register(client)
    csv_text = "commodity,market,district,price_date,price_lkr_per_kg,source\n" + "\n".join(
        f"green gram,Dambulla,Matale,2026-0{m}-01,{400 + m * 10},TEST FIXTURE" for m in range(1, 8)) + "\nbad,row,,notadate,1,x\n"
    r = client.post("/api/v1/market/import", headers=h, files={"file": ("prices.csv", io.BytesIO(csv_text.encode()), "text/csv")})
    assert r.status_code == 200, r.text
    assert r.json()["upserted"] == 7 and len(r.json()["errors"]) == 1
    s = client.get("/api/v1/market/summary?commodity=green_gram", headers=h).json()
    assert s["available"] and s["observations"] == 7 and s["forecast"]["available"] is False


def test_admin_requires_superadmin_and_updates_price(client):
    h, _ = register(client)
    assert client.get("/api/v1/admin/stats", headers=h).status_code == 403
    from app.db import SessionLocal
    from app.seed import ensure_superadmin
    db = SessionLocal()
    ensure_superadmin(db, "root@example.com", "RootPass123")
    db.close()
    tok = client.post("/api/v1/auth/login", json={"email": "root@example.com", "password": "RootPass123"}).json()["access_token"]
    ha = {"Authorization": f"Bearer {tok}"}
    assert client.get("/api/v1/admin/stats", headers=ha).json()["organizations"] == 1
    r = client.patch("/api/v1/admin/plans/farm", headers=ha, json={"price_amount": 123.0, "price_currency": "USD", "billing_period": "monthly"})
    assert r.status_code == 200
    plan = next(p for p in client.get("/api/v1/subscriptions/plans").json()["items"] if p["key"] == "farm")
    assert plan["price_amount"] == 123.0


def test_automation_requires_key_and_is_idempotent(client):
    assert client.post("/api/v1/automation/run", json={"kind": "weekly_report"}).status_code == 401
    k = {"X-Automation-Key": "test-automation-key"}
    r1 = client.post("/api/v1/automation/run", headers=k, json={"kind": "weekly_report", "idempotency_key": "wk-1", "wait": True}).json()
    r2 = client.post("/api/v1/automation/run", headers=k, json={"kind": "weekly_report", "idempotency_key": "wk-1", "wait": True}).json()
    assert r1["status"] == "succeeded" and r2["created"] is False and r1["job_id"] == r2["job_id"]


def test_contact_honeypot(client):
    assert client.post("/api/v1/contact", json={"name": "Bob", "email": "b@example.com", "message": "hi"}).status_code == 201
    assert client.post("/api/v1/contact", json={"name": "Bot", "email": "b@example.com", "website": "spam"}).status_code == 422


def test_ndvi_reports_unavailable_without_fabrication(client):
    h, _ = register(client)
    r = client.get("/api/v1/vegetation/ndvi", headers=h).json()
    assert r["available"] is False and r["series"] == []
    assert "Copernicus" in r["provenance"]["provider"]


def test_automation_market_import_and_alert_emails(client):
    k = {"X-Automation-Key": "test-automation-key"}
    csv_text = "commodity,market,price_date,price_lkr_per_kg,source\nsesame,Dambulla,2026-01-05,610,TEST FIXTURE\n"
    r = client.post("/api/v1/automation/market-import", headers=k, files={"file": ("p.csv", io.BytesIO(csv_text.encode()), "text/csv")})
    assert r.status_code == 200 and r.json()["upserted"] == 1
    assert client.post("/api/v1/automation/market-import", files={"file": ("p.csv", io.BytesIO(b"x"), "text/csv")}).status_code == 401
    h, d = register(client)
    from app.db import SessionLocal, set_tenant
    from app.models import Notification
    db = SessionLocal(); set_tenant(db, None, bypass=True)
    db.add(Notification(org_id=d["org_id"], kind="risk_alert", title="Rainfall deficit in Ampara", body="test"))
    db.commit(); db.close()
    r1 = client.post("/api/v1/automation/run", headers=k, json={"kind": "email_notifications", "wait": True}).json()
    r2 = client.post("/api/v1/automation/run", headers=k, json={"kind": "email_notifications", "wait": True}).json()
    assert r1["result"] == {"notifications": 1, "emails": 1}
    assert r2["result"]["notifications"] == 0  # idempotent: never emailed twice
