from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db
from ..deps import current_admin
from ..services import aggregations


router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.post("/query", response_model=schemas.AnalyticsOut)
def query(
    body: schemas.AnalyticsQueryIn,
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(current_admin),
):
    return aggregations.run_analytics(db, body)


@router.get("/surveys/{survey_id}/summary")
def survey_summary(
    survey_id: int,
    db: Session = Depends(get_db),
    _: models.AdminUser = Depends(current_admin),
):
    per_q = aggregations.aggregate_per_question(db, survey_id)
    by_gender = aggregations.demographic_breakdown(db, survey_id, "gender")
    by_occ = aggregations.demographic_breakdown(db, survey_id, "occupation")
    by_age = aggregations.demographic_breakdown(db, survey_id, "age_bucket")
    return {
        "per_question": per_q.to_dict(orient="records"),
        "by_gender": by_gender.to_dict(orient="records") if not by_gender.empty else [],
        "by_occupation": by_occ.to_dict(orient="records") if not by_occ.empty else [],
        "by_age_bucket": by_age.to_dict(orient="records") if not by_age.empty else [],
    }
