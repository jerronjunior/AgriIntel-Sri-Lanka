import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from app.core.config import get_settings
from app.rate_limit import limiter
from app.routers import admin, auth, economics, farms, intelligence, organizations, saas, system

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
s = get_settings()

app = FastAPI(title=s.APP_NAME, version="0.1.0", openapi_url=f"{s.API_PREFIX}/openapi.json",
              docs_url=f"{s.API_PREFIX}/docs", redoc_url=f"{s.API_PREFIX}/redoc",
              description="AgriIntel Sri Lanka — satellite-driven agricultural decision support. "
                          "All errors use the shape {error, message, details?}.")
app.state.limiter = limiter

app.add_middleware(CORSMiddleware, allow_origins=s.CORS_ORIGINS, allow_credentials=False,
                   allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"], allow_headers=["Authorization", "Content-Type", "X-Org-Id"])


@app.middleware("http")
async def security_headers(request: Request, call_next):
    resp = await call_next(request)
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("X-Frame-Options", "DENY")
    resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    resp.headers.setdefault("Permissions-Policy", "geolocation=(), camera=(), microphone=()")
    if s.is_production:
        resp.headers.setdefault("Strict-Transport-Security", "max-age=63072000; includeSubDomains")
    return resp


@app.exception_handler(HTTPException)
async def http_exc(_: Request, exc: HTTPException):
    d = exc.detail
    body = d if isinstance(d, dict) and "error" in d else {"error": "http_error", "message": str(d)}
    return JSONResponse(body, status_code=exc.status_code, headers=getattr(exc, "headers", None))


@app.exception_handler(RequestValidationError)
async def validation_exc(_: Request, exc: RequestValidationError):
    details = [{"loc": list(e.get("loc", [])), "msg": e.get("msg")} for e in exc.errors()]
    return JSONResponse({"error": "validation_error", "message": "Request validation failed", "details": details}, status_code=422)


@app.exception_handler(RateLimitExceeded)
async def rate_exc(_: Request, exc: RateLimitExceeded):
    return JSONResponse({"error": "rate_limited", "message": f"Too many requests: {exc.detail}"}, status_code=429)


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception):
    logging.getLogger("agriintel").exception("unhandled error")
    return JSONResponse({"error": "internal_error", "message": "An unexpected error occurred"}, status_code=500)


for r in (system.router, auth.router, organizations.router, farms.router, intelligence.router, economics.router, saas.router, admin.router):
    app.include_router(r, prefix=s.API_PREFIX)
