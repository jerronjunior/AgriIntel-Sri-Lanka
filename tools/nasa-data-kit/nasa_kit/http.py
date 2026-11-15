"""HTTP helper: timeouts, retries with backoff, Retry-After for rate limits."""
import time

import httpx

from .config import settings

RETRYABLE = {429, 500, 502, 503, 504}


class UpstreamError(Exception):
    def __init__(self, source: str, message: str, status: int | None = None):
        super().__init__(f"{source}: {message}")
        self.source, self.message, self.status = source, message, status


def client() -> httpx.Client:
    return httpx.Client(timeout=settings().timeout, follow_redirects=True)


def request(method: str, source: str, url: str, c: httpx.Client | None = None, **kw) -> httpx.Response:
    s = settings()
    own = c is None
    c = c or client()
    try:
        last = None
        for attempt in range(s.retries + 1):
            try:
                r = c.request(method, url, **kw)
                if r.status_code in RETRYABLE and attempt < s.retries:
                    time.sleep(min(float(r.headers.get("Retry-After", 0) or 0) or 2 ** attempt, 30))
                    continue
                return r
            except (httpx.TimeoutException, httpx.TransportError) as e:
                last = e
                if attempt < s.retries:
                    time.sleep(2 ** attempt)
        raise UpstreamError(source, f"unreachable after retries: {last}")
    finally:
        if own:
            c.close()


def get_json(source: str, url: str, c: httpx.Client | None = None, **kw) -> dict | list:
    r = request("GET", source, url, c, **kw)
    if r.status_code >= 400:
        raise UpstreamError(source, f"HTTP {r.status_code}: {r.text[:300]}", r.status_code)
    return r.json()
