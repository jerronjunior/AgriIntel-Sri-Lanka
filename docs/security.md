# Security model

* **Authentication**: bcrypt (cost 12) password hashes; HS256 JWT access (30 min) + refresh (7 days) tokens with a
  per-user `token_version` so password reset / "log out everywhere" / suspension revoke all tokens. Single-use,
  hashed, expiring tokens for email verification, password reset and invitations. No user enumeration on reset.
* **Authorization**: enforced in FastAPI (`require(permission, feature)`) and in PostgreSQL via RLS on all tenant
  tables. The API connects as `agri_app` (NOSUPERUSER, NOBYPASSRLS); tests prove a raw connection sees zero rows
  without the tenant setting. Platform admin and automation paths opt in to `app.bypass_rls` explicitly.
* **Input validation**: Pydantic schemas everywhere, GeoJSON validated with Shapely and bounded to Sri Lanka, CSV
  uploads limited to 5 MB UTF-8 with per-row validation, contact form honeypot.
* **Rate limiting**: slowapi on auth and contact endpoints (Redis-backed when `REDIS_URL` is set).
* **Headers / CORS**: nosniff, frame DENY, referrer policy, permissions policy, HSTS in production; explicit CORS origins.
* **Secrets**: NASA, Earthdata, SMTP, automation and LLM keys are server-side only. n8n authenticates with
  `X-Automation-Key` (constant-time compare) stored as an n8n credential.
* **Audit**: logins, failed logins, registration, membership/role changes, farm changes, imports, simulations, admin actions.
* **Known hardening items**: move the browser refresh token from localStorage to an httpOnly cookie via a Next.js
  BFF route; add CSP headers on the web app; add refresh-token rotation with reuse detection.
* **Dependency checks**: CI runs `pip-audit` and `npm audit`.
