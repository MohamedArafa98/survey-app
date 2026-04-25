from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db
from ..deps import current_admin


router = APIRouter(prefix="/surveys", tags=["surveys"])


def _hydrate(db: Session, s: models.Survey) -> dict:
    qcount = db.scalar(
        select(func.count(models.Question.id)).where(models.Question.survey_id == s.id)
    ) or 0
    rcount = db.scalar(
        select(func.count(models.Response.id)).where(models.Response.survey_id == s.id)
    ) or 0
    return {
        "id": s.id,
        "title": s.title,
        "description": s.description,
        "period_label": s.period_label,
        "state": s.state,
        "created_at": s.created_at,
        "opened_at": s.opened_at,
        "closed_at": s.closed_at,
        "cloned_from_id": s.cloned_from_id,
        "question_count": qcount,
        "response_count": rcount,
    }


@router.get("", response_model=list[schemas.SurveyOut])
def list_surveys(
    state: Optional[str] = Query(default=None),
    period: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(current_admin),
):
    stmt = select(models.Survey).order_by(models.Survey.created_at.desc())
    if state:
        stmt = stmt.where(models.Survey.state == state)
    if period:
        stmt = stmt.where(models.Survey.period_label == period)
    rows = db.scalars(stmt).all()
    return [_hydrate(db, s) for s in rows]


@router.post("", response_model=schemas.SurveyOut, status_code=201)
def create_survey(
    body: schemas.SurveyIn,
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(current_admin),
):
    s = models.Survey(title=body.title, description=body.description, period_label=body.period_label)
    db.add(s)
    db.commit()
    db.refresh(s)
    return _hydrate(db, s)


@router.get("/{survey_id}", response_model=schemas.SurveyDetailOut)
def get_survey(
    survey_id: int,
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(current_admin),
):
    s = db.get(models.Survey, survey_id)
    if not s:
        raise HTTPException(404, "Not found")
    base = _hydrate(db, s)
    base["questions"] = s.questions
    base["categories"] = s.categories
    return base


@router.patch("/{survey_id}", response_model=schemas.SurveyOut)
def patch_survey(
    survey_id: int,
    body: schemas.SurveyPatchIn,
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(current_admin),
):
    s = db.get(models.Survey, survey_id)
    if not s:
        raise HTTPException(404, "Not found")
    if body.title is not None:
        s.title = body.title
    if body.description is not None:
        s.description = body.description
    if body.period_label is not None:
        s.period_label = body.period_label
    db.commit()
    db.refresh(s)
    return _hydrate(db, s)


@router.delete("/{survey_id}")
def delete_survey(
    survey_id: int,
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(current_admin),
):
    s = db.get(models.Survey, survey_id)
    if not s:
        raise HTTPException(404, "Not found")
    db.delete(s)
    db.commit()
    return {"ok": True}


@router.post("/{survey_id}/state", response_model=schemas.SurveyOut)
def change_state(
    survey_id: int,
    body: schemas.SurveyStateIn,
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(current_admin),
):
    s = db.get(models.Survey, survey_id)
    if not s:
        raise HTTPException(404, "Not found")
    s.state = body.state
    now = datetime.now(timezone.utc)
    if body.state == "open":
        s.opened_at = now
        s.closed_at = None
    elif body.state == "closed":
        s.closed_at = now
    db.commit()
    db.refresh(s)
    return _hydrate(db, s)


@router.get("/{survey_id}/responses", response_model=list[schemas.ResponseWithAnswersOut])
def list_recent_responses(
    survey_id: int,
    limit: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(current_admin),
):
    s = db.get(models.Survey, survey_id)
    if not s:
        raise HTTPException(404, "Not found")
    rows = db.scalars(
        select(models.Response)
        .where(models.Response.survey_id == survey_id)
        .order_by(models.Response.submitted_at.desc())
        .limit(limit)
    ).all()
    return rows


@router.post("/{survey_id}/clone", response_model=schemas.SurveyOut, status_code=201)
def clone_survey(
    survey_id: int,
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(current_admin),
):
    src = db.get(models.Survey, survey_id)
    if not src:
        raise HTTPException(404, "Not found")
    dup = models.Survey(
        title=f"{src.title} (copy)",
        description=src.description,
        period_label=src.period_label,
        state="draft",
        cloned_from_id=src.id,
    )
    db.add(dup)
    db.flush()
    cat_map: dict[int, int] = {}
    for c in src.categories:
        new_cat = models.QuestionCategory(
            survey_id=dup.id,
            name=c.name,
            order_index=c.order_index,
        )
        db.add(new_cat)
        db.flush()
        cat_map[c.id] = new_cat.id
    for q in src.questions:
        db.add(
            models.Question(
                survey_id=dup.id,
                order_index=q.order_index,
                text=q.text,
                scale_min=q.scale_min,
                scale_max=q.scale_max,
                allow_comment=q.allow_comment,
                category_id=cat_map.get(q.category_id) if q.category_id else None,
            )
        )
    db.commit()
    db.refresh(dup)
    return _hydrate(db, dup)
