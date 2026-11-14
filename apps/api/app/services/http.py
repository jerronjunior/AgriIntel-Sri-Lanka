"""Shared HTTP helper with timeouts, retries (exponential backoff) and rate-limit handling."""
import logging
import time

import httpx

from app.core.config import get_settings

log = logging.getLogger("agriintel.http")


class UpstreamError(Exception):
    def __init__(self, source: str, message: str, status: int | None = None):
        super().__init__(f"{source}: {message}")
        self.source, self.message, self.status = source, message, status


RETRYABLE = {429, 500, 502, 503, 504}


def get_json(source: str, url: str, params: dict | None = None, headers: dict | None = None,
             client: httpx.Client | None = None) -> dict:
    s = get_settings()
    own = client is None
    client = client or httpx.Client(timeout=s.HTTP_TIMEOUT_SECONDS, follow_redirects=True)
    try:
        last_exc: Exception | None = None
        for attempt in range(s.HTTP_MAX_RETRIES + 1):
            try:
                r = client.get(url, params=params, headers=headers)
                if r.status_code in RETRYABLE and attempt < s.HTTP_MAX_RETRIES:
                    wait = float(r.headers.get("Retry-After", 0) or 0) or (2 ** attempt)
                    log.warning("%s returned %s, retrying in %.1fs", source, r.status_code, wait)
                    time.sleep(min(wait, 30))
                    continue
                if r.status_code >= 400:
                    raise UpstreamError(source, f"HTTP {r.status_code}: {r.text[:300]}", r.status_code)
                return r.json()
            except (httpx.TimeoutException, httpx.TransportError) as e:
                last_exc = e
                if attempt < s.HTTP_MAX_RETRIES:
                    time.sleep(2 ** attempt)
                    continue
        raise UpstreamError(source, f"unreachable after retries: {last_exc}")
    finally:
        if own:
            client.close()
