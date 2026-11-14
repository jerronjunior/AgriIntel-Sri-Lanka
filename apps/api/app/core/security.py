import hashlib
import secrets
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from app.core.config import get_settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except ValueError:
        return False


def _encode(sub: str, token_type: str, expires: timedelta, extra: dict | None = None) -> str:
    s = get_settings()
    now = datetime.now(UTC)
    payload = {"sub": sub, "type": token_type, "iat": now, "exp": now + expires, "jti": secrets.token_hex(8)}
    if extra:
        payload.update(extra)
    return jwt.encode(payload, s.JWT_SECRET, algorithm=s.JWT_ALGORITHM)


def create_access_token(user_id: str, token_version: int) -> str:
    return _encode(user_id, "access", timedelta(minutes=get_settings().ACCESS_TOKEN_MINUTES), {"tv": token_version})


def create_refresh_token(user_id: str, token_version: int) -> str:
    return _encode(user_id, "refresh", timedelta(days=get_settings().REFRESH_TOKEN_DAYS), {"tv": token_version})


def decode_token(token: str, expected_type: str) -> dict:
    s = get_settings()
    payload = jwt.decode(token, s.JWT_SECRET, algorithms=[s.JWT_ALGORITHM], options={"require": ["exp", "sub", "type"]})
    if payload.get("type") != expected_type:
        raise jwt.InvalidTokenError("wrong token type")
    return payload


def new_opaque_token() -> tuple[str, str]:
    """Returns (raw_token, sha256_hash). Only the hash is stored."""
    raw = secrets.token_urlsafe(32)
    return raw, sha256(raw)


def sha256(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()
