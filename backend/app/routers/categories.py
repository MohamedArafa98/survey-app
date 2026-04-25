from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db
from ..deps import current_admin


router = APIRouter(prefix="/surveys/{survey_id}/categories", tags=["categories"])


@router.get("", response_model=list[schemas.CategoryOut])
def list_categories(
    survey_id: int,
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(current_admin),
):
    return db.scalars(
        select(models.QuestionCategory)
        .where(models.QuestionCategory.survey_id == survey_id)
        .order_by(models.QuestionCategory.order_index)
    ).all()


@router.post("", response_model=schemas.CategoryOut, status_code=201)
def create_category(
    survey_id: int,
    body: schemas.CategoryIn,
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(current_admin),
):
    if not db.get(models.Survey, survey_id):
        raise HTTPException(404, "Survey not found")
    idx = body.order_index
    if idx is None:
        cur_max = db.scalar(
            select(func.coalesce(func.max(models.QuestionCategory.order_index), -1)).where(
                models.QuestionCategory.survey_id == survey_id
            )
        )
        idx = (cur_max or -1) + 1
    cat = models.QuestionCategory(
        survey_id=survey_id,
        name=body.name.strip(),
        order_index=idx,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.patch("/{category_id}", response_model=schemas.CategoryOut)
def patch_category(
    survey_id: int,
    category_id: int,
    body: schemas.CategoryPatchIn,
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(current_admin),
):
    cat = db.get(models.QuestionCategory, category_id)
    if not cat or cat.survey_id != survey_id:
        raise HTTPException(404, "Not found")
    if body.name is not None:
        cat.name = body.name.strip()
    if body.order_index is not None:
        cat.order_index = body.order_index
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/{category_id}")
def delete_category(
    survey_id: int,
    category_id: int,
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(current_admin),
):
    cat = db.get(models.QuestionCategory, category_id)
    if not cat or cat.survey_id != survey_id:
        raise HTTPException(404, "Not found")
    db.execute(
        update(models.Question)
        .where(models.Question.category_id == category_id)
        .values(category_id=None)
    )
    db.delete(cat)
    db.commit()
    return {"ok": True}


@router.post("/reorder")
def reorder(
    survey_id: int,
    body: schemas.CategoryReorderIn,
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(current_admin),
):
    rows = db.scalars(
        select(models.QuestionCategory).where(models.QuestionCategory.survey_id == survey_id)
    ).all()
    by_id = {c.id: c for c in rows}
    for i, cid in enumerate(body.order):
        if cid in by_id:
            by_id[cid].order_index = i
    db.commit()
    return {"ok": True}
