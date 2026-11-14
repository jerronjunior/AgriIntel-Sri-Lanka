import uuid

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.data.reference import DISTRICT_BY_NAME
from app.db import get_db
from app.deps import OrgContext, api_error, client_ip, require
from app.models import Farm, FarmBoundary
from app.schemas import FarmIn, FarmOut
from app.services.common import audit, validate_polygon

router = APIRouter(prefix="/farms", tags=["farms"])


def _out(f: Farm) -> FarmOut:
    o = FarmOut.model_validate(f)
    o.boundary_geojson = f.boundary.geojson if f.boundary else None
    return o


def _get(db: Session, ctx: OrgContext, farm_id: uuid.UUID) -> Farm:
    f = db.query(Farm).filter_by(id=farm_id, org_id=ctx.org.id).one_or_none()  # app-level tenant filter (+ RLS)
    if not f:
        raise api_error(404, "not_found", "Farm not found")
    return f


def _apply(db: Session, ctx: OrgContext, f: Farm, body: FarmIn) -> None:
    if body.district.lower() not in DISTRICT_BY_NAME:
        raise api_error(422, "invalid_district", f"Unknown district '{body.district}'")
    f.name, f.district, f.irrigation, f.notes = body.name, DISTRICT_BY_NAME[body.district.lower()]["name"], body.irrigation, body.notes
    if body.boundary:
        try:
            geom, area, (lat, lon) = validate_polygon(body.boundary)
        except ValueError as e:
            raise api_error(422, "invalid_boundary", str(e))
        f.latitude, f.longitude, f.area_ha = round(lat, 6), round(lon, 6), area
        if f.boundary:
            f.boundary.geojson, f.boundary.area_ha = geom, area
        else:
            f.boundary = FarmBoundary(org_id=ctx.org.id, geojson=geom, area_ha=area)
    elif body.latitude is not None and body.longitude is not None:
        f.latitude, f.longitude = body.latitude, body.longitude
    elif f.latitude is None:
        raise api_error(422, "location_required", "Provide a boundary polygon or latitude/longitude")


@router.get("", response_model=dict)
def list_farms(page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=500), district: str | None = None,
               q: str | None = Query(None, max_length=100), ctx: OrgContext = Depends(require("farms:read")), db: Session = Depends(get_db)):
    query = db.query(Farm).filter_by(org_id=ctx.org.id)
    if district:
        query = query.filter(func.lower(Farm.district) == district.lower())
    if q:
        query = query.filter(Farm.name.ilike(f"%{q}%"))
    total = query.count()
    items = query.order_by(Farm.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": [_out(f).model_dump(mode="json") for f in items], "total": total, "page": page, "page_size": page_size}


@router.post("", response_model=FarmOut, status_code=201)
def create_farm(body: FarmIn, request: Request, ctx: OrgContext = Depends(require("farms:write")), db: Session = Depends(get_db)):
    max_farms = (ctx.limits or {}).get("max_farms")
    if max_farms is not None and db.query(func.count(Farm.id)).filter_by(org_id=ctx.org.id).scalar() >= max_farms:
        raise api_error(402, "limit_reached", f"Your plan allows {max_farms} farms")
    if db.query(Farm).filter_by(org_id=ctx.org.id, name=body.name).first():
        raise api_error(409, "duplicate", "A farm with this name already exists")
    f = Farm(org_id=ctx.org.id, latitude=None, longitude=None)
    _apply(db, ctx, f, body)
    db.add(f)
    db.flush()
    audit(db, "farm.created", user_id=ctx.user.id, org_id=ctx.org.id, target_type="farm", target_id=f.id, ip=client_ip(request))
    db.commit()
    return _out(f)


@router.get("/export.geojson")
def export_geojson(ctx: OrgContext = Depends(require("farms:read")), db: Session = Depends(get_db)):
    feats = []
    for f in db.query(Farm).filter_by(org_id=ctx.org.id).all():
        geom = f.boundary.geojson if f.boundary else {"type": "Point", "coordinates": [f.longitude, f.latitude]}
        feats.append({"type": "Feature", "geometry": geom, "properties": {
            "id": str(f.id), "name": f.name, "district": f.district, "area_ha": f.area_ha, "irrigation": f.irrigation}})
    return {"type": "FeatureCollection", "features": feats}


@router.post("/import.geojson")
def import_geojson(fc: dict, request: Request, ctx: OrgContext = Depends(require("farms:write")), db: Session = Depends(get_db)):
    if fc.get("type") != "FeatureCollection" or not isinstance(fc.get("features"), list):
        raise api_error(422, "invalid_geojson", "Expected a GeoJSON FeatureCollection")
    if len(fc["features"]) > 500:
        raise api_error(413, "too_many_features", "Import at most 500 features at a time")
    created, errors = 0, []
    for i, feat in enumerate(fc["features"]):
        props = feat.get("properties") or {}
        try:
            body = FarmIn(name=str(props.get("name") or f"Imported farm {i + 1}")[:200], district=str(props.get("district", "")),
                          irrigation=props.get("irrigation", "none"), boundary=feat)
            if db.query(Farm).filter_by(org_id=ctx.org.id, name=body.name).first():
                raise ValueError("duplicate name")
            f = Farm(org_id=ctx.org.id)
            _apply(db, ctx, f, body)
            db.add(f)
            db.flush()
            created += 1
        except Exception as e:  # collect per-feature errors, keep going
            detail = getattr(e, "detail", None)
            errors.append({"index": i, "error": detail.get("message") if isinstance(detail, dict) else str(e)[:200]})
    audit(db, "farm.imported", user_id=ctx.user.id, org_id=ctx.org.id, meta={"created": created, "errors": len(errors)}, ip=client_ip(request))
    db.commit()
    return {"created": created, "errors": errors}


@router.get("/{farm_id}", response_model=FarmOut)
def get_farm(farm_id: uuid.UUID, ctx: OrgContext = Depends(require("farms:read")), db: Session = Depends(get_db)):
    return _out(_get(db, ctx, farm_id))


@router.put("/{farm_id}", response_model=FarmOut)
def update_farm(farm_id: uuid.UUID, body: FarmIn, ctx: OrgContext = Depends(require("farms:write")), db: Session = Depends(get_db)):
    f = _get(db, ctx, farm_id)
    _apply(db, ctx, f, body)
    audit(db, "farm.updated", user_id=ctx.user.id, org_id=ctx.org.id, target_type="farm", target_id=f.id)
    db.commit()
    return _out(f)


@router.delete("/{farm_id}", status_code=204)
def delete_farm(farm_id: uuid.UUID, ctx: OrgContext = Depends(require("farms:write")), db: Session = Depends(get_db)):
    f = _get(db, ctx, farm_id)
    db.delete(f)
    audit(db, "farm.deleted", user_id=ctx.user.id, org_id=ctx.org.id, target_type="farm", target_id=farm_id)
    db.commit()
