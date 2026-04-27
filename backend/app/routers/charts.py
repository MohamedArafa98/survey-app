from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db
from ..deps import current_admin

router = APIRouter(prefix="/charts", tags=["charts"])

@router.get("", response_model=list[schemas.ChartDefOut])
def list_charts(
    survey_id: int | None = None,
    deleted: bool = False,
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(current_admin),
):
    stmt = select(models.ChartDef).order_by(models.ChartDef.created_at.desc())
    stmt = stmt.where(models.ChartDef.is_deleted == deleted)
    if survey_id is not None:
        stmt = stmt.where(models.ChartDef.survey_id == survey_id)
    return db.scalars(stmt).all()


@router.post("", response_model=schemas.ChartDefOut, status_code=201)
def create_chart(
    body: schemas.ChartDefIn,
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(current_admin),
):
    c = models.ChartDef(
        name=body.name,
        survey_id=body.survey_id,
        config_json=body.config_json,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.patch("/{chart_id}", response_model=schemas.ChartDefOut)
def update_chart(
    chart_id: int,
    body: schemas.ChartDefIn,
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(current_admin),
):
    c = db.get(models.ChartDef, chart_id)
    if not c or c.is_deleted:
        raise HTTPException(404, "Not found")
    c.name = body.name
    c.survey_id = body.survey_id
    c.config_json = body.config_json
    db.commit()
    db.refresh(c)
    return c


@router.delete("/{chart_id}")
def delete_chart(
    chart_id: int,
    hard: bool = False,
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(current_admin),
):
    c = db.get(models.ChartDef, chart_id)
    if not c:
        raise HTTPException(404, "Not found")
    if hard:
        db.delete(c)
    else:
        c.is_deleted = True
    db.commit()
    return {"ok": True}


@router.post("/{chart_id}/restore")
def restore_chart(
    chart_id: int,
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(current_admin),
):
    c = db.get(models.ChartDef, chart_id)
    if not c:
        raise HTTPException(404, "Not found")
    c.is_deleted = False
    db.commit()
    return {"ok": True}
