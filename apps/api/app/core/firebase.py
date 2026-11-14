from functools import lru_cache
import jwt
from jwt import PyJWKClient

from app.core.config import get_settings

GOOGLE_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
_jwks_client: PyJWKClient | None = None


def get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient(GOOGLE_JWKS_URL, cache_keys=True, lifespan=3600)
    return _jwks_client


def verify_id_token(id_token: str) -> dict:
    """
    Verify a Firebase ID token using Google's public JWKS endpoint.
    This does not require Google Application Default Credentials or a service account key,
    preventing timeouts when attempting to reach the GCE metadata server in local environments.
    """
    settings = get_settings()
    project_id = settings.FIREBASE_PROJECT_ID
    if not project_id:
        raise ValueError("FIREBASE_PROJECT_ID must be configured for Firebase authentication")

    try:
        jwks_client = get_jwks_client()
        signing_key = jwks_client.get_signing_key_from_jwt(id_token)
        claims = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=project_id,
            issuer=f"https://securetoken.google.com/{project_id}",
            options={"verify_exp": True},
        )
        # Ensure uid field is populated if sub is present
        if "uid" not in claims and "sub" in claims:
            claims["uid"] = claims["sub"]
        return claims
    except Exception as exc:
        raise ValueError(f"Firebase token verification failed: {exc}") from exc
