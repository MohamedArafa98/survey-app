from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db
from ..deps import current_admin


router = APIRouter(prefix="/surveys/{survey_id}/questions", tags=["questions"])


def _has_responses(db: Session, survey_id: int) -> bool:
    return bool(
        db.scalar(
            select(func.count(models.Response.id)).where(models.Response.survey_id == survey_id)
        )
    )


@router.get("", response_model=list[schemas.QuestionOut])
def list_questions(survey_id: int, db: Session = Depends(get_db), _: models.AdminUser = Depends(current_admin)):
    return db.scalars(
        select(models.Question)
        .where(models.Question.survey_id == survey_id)
        .order_by(models.Question.order_index)
    ).all()


def _validate_category(db: Session, survey_id: int, category_id: Optional[int]) -> None:
    if category_id is None:
        return
    cat = db.get(models.QuestionCategory, category_id)
    if not cat or cat.survey_id != survey_id:
        raise HTTPException(400, "Category does not belong to this survey")


@router.post("", response_model=schemas.QuestionOut, status_code=201)
def create_question(
    survey_id: int,
    body: schemas.QuestionIn,
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(current_admin),
):
    if not db.get(models.Survey, survey_id):
        raise HTTPException(404, "Survey not found")
    _validate_category(db, survey_id, body.category_id)
    idx = body.order_index
    if idx is None:
        cur_max = db.scalar(
            select(func.coalesce(func.max(models.Question.order_index), -1)).where(
                models.Question.survey_id == survey_id
            )
        )
        idx = (cur_max or -1) + 1
    q = models.Question(
        survey_id=survey_id,
        text=body.text,
        allow_comment=body.allow_comment,
        order_index=idx,
        category_id=body.category_id,
    )
    db.add(q)
    db.commit()
    db.refresh(q)
    return q


@router.patch("/{question_id}", response_model=schemas.QuestionOut)
def patch_question(
    survey_id: int,
    question_id: int,
    body: schemas.QuestionPatchIn,
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(current_admin),
):
    q = db.get(models.Question, question_id)
    if not q or q.survey_id != survey_id:
        raise HTTPException(404, "Not found")
    data = body.model_dump(exclude_unset=True)
    if "category_id" in data:
        _validate_category(db, survey_id, data["category_id"])
        q.category_id = data["category_id"]
    if "text" in data and data["text"] is not None:
        q.text = data["text"]
    if "allow_comment" in data and data["allow_comment"] is not None:
        q.allow_comment = data["allow_comment"]
    if "order_index" in data and data["order_index"] is not None:
        q.order_index = data["order_index"]
    db.commit()
    db.refresh(q)
    return q


@router.delete("/{question_id}")
def delete_question(
    survey_id: int,
    question_id: int,
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(current_admin),
):
    q = db.get(models.Question, question_id)
    if not q or q.survey_id != survey_id:
        raise HTTPException(404, "Not found")
    db.delete(q)
    db.commit()
    return {"ok": True}


@router.post("/reorder")
def reorder(
    survey_id: int,
    body: schemas.QuestionReorderIn,
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(current_admin),
):
    rows = db.scalars(
        select(models.Question).where(models.Question.survey_id == survey_id)
    ).all()
    by_id = {q.id: q for q in rows}
    for i, qid in enumerate(body.order):
        if qid in by_id:
            by_id[qid].order_index = i
    db.commit()
    return {"ok": True}
