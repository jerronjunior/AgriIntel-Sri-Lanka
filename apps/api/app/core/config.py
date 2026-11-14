"""Application settings, loaded from environment variables (see /.env.example)."""
from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    ENV: str = "development"
    APP_NAME: str = "AgriIntel Sri Lanka API"
    API_PREFIX: str = "/api/v1"

    # Database: the API should connect as a NON-superuser role so Row Level Security applies.
    DATABASE_URL: str = "postgresql+psycopg://agri_app:agri_app@localhost:5432/agriintel"
    REDIS_URL: str | None = None

    # Auth
    JWT_SECRET: str = "change-me-in-production-please-32+chars"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_MINUTES: int = 30
    REFRESH_TOKEN_DAYS: int = 7
    FIREBASE_PROJECT_ID: str = ""
    # Development only: echo verification/reset tokens in API responses so the flow can be tested without SMTP.
    EMAIL_DEV_ECHO: bool = False

    # CORS
    CORS_ORIGINS: str | list[str] = ["http://localhost:3000"]

    # Email (SMTP). If SMTP_HOST is empty, emails are logged instead of sent.
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "AgriIntel <no-reply@agriintel.local>"
    FRONTEND_URL: str = "http://localhost:3000"

    # NASA / Earth observation
    NASA_POWER_BASE_URL: str = "https://power.larc.nasa.gov/api"
    NASA_CMR_BASE_URL: str = "https://cmr.earthdata.nasa.gov/search"
    EARTHDATA_TOKEN: str = ""  # Earthdata Login bearer token (server-side only)
    HTTP_TIMEOUT_SECONDS: float = 30.0
    HTTP_MAX_RETRIES: int = 3

    # n8n / automation (shared secret, server-to-server only — never sent to the browser)
    AUTOMATION_API_KEY: str = ""

    # Optional LLM assistant (server-side only)
    LLM_API_KEY: str = ""

    @field_validator("CORS_ORIGINS", mode="after")
    @classmethod
    def split_origins(cls, v):
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    @property
    def is_production(self) -> bool:
        return self.ENV == "production"


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if s.is_production:
        if s.JWT_SECRET.startswith("change-me") or len(s.JWT_SECRET) < 32:
            raise RuntimeError("JWT_SECRET must be set to a strong value in production")
        if s.EMAIL_DEV_ECHO:
            raise RuntimeError("EMAIL_DEV_ECHO must be false in production")
    return s
