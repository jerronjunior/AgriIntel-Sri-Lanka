"""Small shared services: audit logging, email, geometry."""
import logging
import smtplib
from email.message import EmailMessage

from pyproj import Geod
from shapely.geometry import shape
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import AuditLog

log = logging.getLogger("agriintel")
_geod = Geod(ellps="WGS84")


def audit(db: Session, action: str, *, user_id=None, org_id=None, target_type=None, target_id=None, meta=None, ip=None) -> None:
    db.add(AuditLog(action=action, user_id=user_id, org_id=org_id, target_type=target_type,
                    target_id=str(target_id) if target_id else None, meta=meta or {}, ip=ip))


def send_email(to: str, subject: str, body: str) -> None:
    s = get_settings()
    if not s.SMTP_HOST:
        log.info("EMAIL (SMTP not configured) to=%s subject=%s\n%s", to, subject, body)
        return
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = s.SMTP_FROM, to, subject
    msg.set_content(body)
    with smtplib.SMTP(s.SMTP_HOST, s.SMTP_PORT, timeout=20) as smtp:
        smtp.starttls()
        if s.SMTP_USER:
            smtp.login(s.SMTP_USER, s.SMTP_PASSWORD)
        smtp.send_message(msg)


def validate_polygon(geojson: dict) -> tuple[dict, float, tuple[float, float]]:
    """Validate a GeoJSON Polygon/MultiPolygon (or Feature). Returns (geometry, geodesic area ha, centroid lat/lon)."""
    geom = geojson.get("geometry") if geojson.get("type") == "Feature" else geojson
    if not geom or geom.get("type") not in ("Polygon", "MultiPolygon"):
        raise ValueError("boundary must be a GeoJSON Polygon or MultiPolygon")
    shp = shape(geom)
    if not shp.is_valid or shp.is_empty:
        raise ValueError("boundary polygon is invalid (self-intersecting or empty)")
    minx, miny, maxx, maxy = shp.bounds
    if not (79.0 <= minx and maxx <= 82.5 and 5.5 <= miny and maxy <= 10.2):
        raise ValueError("boundary must lie within Sri Lanka")
    area_m2, _ = _geod.geometry_area_perimeter(shp)
    c = shp.centroid
    return geom, round(abs(area_m2) / 10000, 4), (c.y, c.x)
