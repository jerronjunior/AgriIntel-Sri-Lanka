from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import get_settings

# Uses Redis when REDIS_URL is configured (shared across replicas); in-memory otherwise.
_s = get_settings()
limiter = Limiter(key_func=get_remote_address, storage_uri=_s.REDIS_URL or "memory://",
                  enabled=_s.ENV != "test")
