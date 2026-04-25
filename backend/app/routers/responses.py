from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db


router = APIRouter(tags=["public"])


@router.get("/public/surveys", response_model=list[schemas.SurveyOut])
def list_open_surveys(db: Session = Depends(get_db)):
    from .surveys import _hydrate
    rows = db.scalars(
        select(models.Survey)
        .where(models.Survey.state == "open")
        .order_by(models.Survey.opened_at.desc().nullslast(), models.Survey.created_at.desc())
    ).all()
    return [_hydrate(db, s) for s in rows]


@router.get("/public/surveys/{survey_id}", response_model=schemas.SurveyDetailOut)
def get_open_survey(survey_id: int, db: Session = Depends(get_db)):
    s = db.get(models.Survey, survey_id)
    if not s or s.state != "open":
        raise HTTPException(404, "Not available")
    from .surveys import _hydrate
    base = _hydrate(db, s)
    base["questions"] = s.questions
    base["categories"] = s.categories
    return base


@router.post("/public/surveys/{survey_id}/responses", response_model=schemas.ResponseOut, status_code=201)
def submit_response(
    survey_id: int,
    body: schemas.ResponseIn,
    db: Session = Depends(get_db),
):
    s = db.get(models.Survey, survey_id)
    if not s or s.state != "open":
        raise HTTPException(404, "Not available")

    valid_qs = {q.id for q in s.questions}
    if not body.answers:
        raise HTTPException(400, "No answers provided")
    if any(a.question_id not in valid_qs for a in body.answers):
        raise HTTPException(400, "Answer references unknown question")

    r = models.Response(
        survey_id=s.id,
        occupation=body.occupation.strip(),
        gender=body.gender,
        age=body.age,
        name=(body.name or None),
    )
    db.add(r)
    db.flush()
    for a in body.answers:
        db.add(
            models.Answer(
                response_id=r.id,
                question_id=a.question_id,
                score=a.score,
                comment=a.comment,
            )
        )
    db.commit()
    db.refresh(r)
    return r
