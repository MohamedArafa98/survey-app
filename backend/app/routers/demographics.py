from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db
from ..deps import current_admin


router = APIRouter(tags=["settings"])


def _get_setting(db: Session, key: str, default):
    row = db.get(models.Setting, key)
    return row.value_json if row else default


def _put_setting(db: Session, key: str, value):
    row = db.get(models.Setting, key)
    if row:
        row.value_json = value
    else:
        db.add(models.Setting(key=key, value_json=value))
    db.commit()


# -- public endpoints (guest form needs occupations) --

@router.get("/public/occupations", response_model=list[str])
def get_occupations_public(db: Session = Depends(get_db)):
    return _get_setting(db, "occupations", [])


@router.get("/public/age-buckets", response_model=list[schemas.AgeBucket])
def get_age_buckets_public(db: Session = Depends(get_db)):
    return _get_setting(db, "age_buckets", [])


@router.get("/public/allow-other-occupation", response_model=schemas.BoolSettingOut)
def get_allow_other_occupation_public(db: Session = Depends(get_db)):
    return {"enabled": bool(_get_setting(db, "allow_other_occupation", True))}


# -- admin endpoints (manage lists) --

@router.get("/settings/occupations", response_model=list[str])
def get_occupations(db: Session = Depends(get_db), _: models.AdminUser = Depends(current_admin)):
    return _get_setting(db, "occupations", [])


@router.put("/settings/occupations", response_model=list[str])
def put_occupations(
    body: schemas.OccupationsIn,
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(current_admin),
):
    cleaned = [o.strip() for o in body.occupations if o.strip()]
    _put_setting(db, "occupations", cleaned)
    return cleaned


@router.get("/settings/age-buckets", response_model=list[schemas.AgeBucket])
def get_age_buckets(db: Session = Depends(get_db), _: models.AdminUser = Depends(current_admin)):
    return _get_setting(db, "age_buckets", [])


@router.put("/settings/age-buckets", response_model=list[schemas.AgeBucket])
def put_age_buckets(
    body: schemas.AgeBucketsIn,
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(current_admin),
):
    serialized = [b.model_dump() for b in body.buckets]
    _put_setting(db, "age_buckets", serialized)
    return serialized


@router.get("/settings/allow-other-occupation", response_model=schemas.BoolSettingOut)
def get_allow_other_occupation(
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(current_admin),
):
    return {"enabled": bool(_get_setting(db, "allow_other_occupation", True))}


@router.put("/settings/allow-other-occupation", response_model=schemas.BoolSettingOut)
def put_allow_other_occupation(
    body: schemas.BoolSettingIn,
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(current_admin),
):
    _put_setting(db, "allow_other_occupation", bool(body.enabled))
    return {"enabled": bool(body.enabled)}
