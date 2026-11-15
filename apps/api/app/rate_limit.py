import logging
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import get_settings

logger = logging.getLogger("app.rate_limit")
_s = get_settings()


def _get_storage_uri() -> str:
    if not _s.REDIS_URL or _s.REDIS_URL.startswith("memory://"):
        return "memory://"
    try:
        import redis
        r = redis.from_url(_s.REDIS_URL, socket_connect_timeout=0.5, socket_timeout=0.5)
        r.ping()
        logger.info("Connected to Redis for rate limiting.")
        return _s.REDIS_URL
    except Exception:
        logger.info("Redis unreachable on port 6379; using in-memory rate limiting storage.")
        return "memory://"


storage_uri = _get_storage_uri()
limiter = Limiter(key_func=get_remote_address, storage_uri=storage_uri, enabled=_s.ENV != "test")
