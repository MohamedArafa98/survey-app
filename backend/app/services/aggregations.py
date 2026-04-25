from __future__ import annotations

from typing import Any

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas


def load_responses_df(db: Session, survey_ids: list[int]) -> pd.DataFrame:
    """Wide-ish long dataframe: one row per (response, answer)."""
    if not survey_ids:
        return pd.DataFrame()

    stmt = (
        select(
            models.Response.id.label("response_id"),
            models.Response.survey_id,
            models.Response.submitted_at,
            models.Response.occupation,
            models.Response.gender,
            models.Response.age,
            models.Response.name,
            models.Answer.question_id,
            models.Answer.score,
            models.Answer.comment,
            models.Question.text.label("question_text"),
            models.Question.order_index.label("question_order"),
            models.Question.category_id,
            models.QuestionCategory.name.label("category_name"),
            models.Survey.title.label("survey_title"),
            models.Survey.period_label.label("survey_period"),
        )
        .join(models.Answer, models.Answer.response_id == models.Response.id)
        .join(models.Question, models.Question.id == models.Answer.question_id)
        .join(models.Survey, models.Survey.id == models.Response.survey_id)
        .outerjoin(
            models.QuestionCategory,
            models.QuestionCategory.id == models.Question.category_id,
        )
        .where(models.Response.survey_id.in_(survey_ids))
    )
    rows = db.execute(stmt).mappings().all()
    df = pd.DataFrame(rows)
    if not df.empty and "category_name" in df.columns:
        df["category_name"] = df["category_name"].fillna("Uncategorized")
    return df


def load_age_buckets(db: Session) -> list[schemas.AgeBucket]:
    row = db.get(models.Setting, "age_buckets")
    items = row.value_json if row else []
    return [schemas.AgeBucket(**i) for i in items]


def _bucketize(series: pd.Series, buckets: list[schemas.AgeBucket]) -> pd.Series:
    if not buckets:
        return series.astype(str)

    def assign(v):
        try:
            iv = int(v)
        except (TypeError, ValueError):
            return "unknown"
        for b in buckets:
            if b.min <= iv <= b.max:
                return b.label
        return "unknown"

    return series.map(assign)


def apply_filters(df: pd.DataFrame, filters: schemas.AnalyticsFilter, buckets: list[schemas.AgeBucket]) -> pd.DataFrame:
    if df.empty:
        return df
    if filters.gender:
        df = df[df["gender"].isin(filters.gender)]
    if filters.occupation:
        df = df[df["occupation"].isin(filters.occupation)]
    if filters.age_buckets:
        age_b = _bucketize(df["age"], buckets)
        df = df[age_b.isin(filters.age_buckets)]
    return df


def run_analytics(db: Session, q: schemas.AnalyticsQueryIn) -> schemas.AnalyticsOut:
    if not q.survey_ids:
        return schemas.AnalyticsOut(points=[], series_names=[], x_labels=[], reason="no_surveys")

    df = load_responses_df(db, q.survey_ids)
    if df.empty:
        return schemas.AnalyticsOut(points=[], series_names=[], x_labels=[], reason="no_responses")

    buckets = load_age_buckets(db)
    filtered = apply_filters(df, q.filters, buckets)
    if filtered.empty:
        return schemas.AnalyticsOut(points=[], series_names=[], x_labels=[], reason="filtered_out")
    df = filtered

    if "age" in df:
        df = df.copy()
        df["age_bucket"] = _bucketize(df["age"], buckets)

    axis_map = {
        "question": "question_text",
        "survey": "survey_title",
        "gender": "gender",
        "occupation": "occupation",
        "age_bucket": "age_bucket",
        "score": "score",
        "category": "category_name",
    }
    x_col = axis_map[q.x_axis]

    group_col = axis_map[q.group_by] if q.group_by else None
    by = [x_col] + ([group_col] if group_col and group_col != x_col else [])

    grp = df.groupby(by, dropna=False)

    if q.metric == "avg":
        agg = grp["score"].mean().round(3)
    elif q.metric == "count":
        agg = grp["response_id"].nunique()
    elif q.metric == "percentage":
        total = df["response_id"].nunique() or 1
        agg = (grp["response_id"].nunique() / total * 100).round(2)
    elif q.metric == "distribution":
        # count of each score (1..5) within group
        agg = grp["score"].value_counts().unstack(fill_value=0).stack()
    else:
        agg = grp["score"].mean()

    points: list[schemas.AnalyticsPoint] = []
    if group_col and group_col != x_col:
        for (x_val, s_val), y in agg.items():
            points.append(schemas.AnalyticsPoint(x=str(x_val), y=float(y), series=str(s_val)))
    else:
        for x_val, y in agg.items():
            points.append(schemas.AnalyticsPoint(x=str(x_val), y=float(y)))

    if not points:
        return schemas.AnalyticsOut(points=[], series_names=[], x_labels=[], reason="empty_groups")

    x_labels = sorted({p.x for p in points}, key=lambda v: str(v))
    series_names = sorted({p.series for p in points if p.series})
    return schemas.AnalyticsOut(points=points, series_names=series_names, x_labels=list(x_labels))


def aggregate_per_question(db: Session, survey_id: int) -> pd.DataFrame:
    df = load_responses_df(db, [survey_id])
    if df.empty:
        return pd.DataFrame(
            columns=[
                "question", "category", "avg_score", "n",
                "pct_1", "pct_2", "pct_3", "pct_4", "pct_5",
            ]
        )
    rows = []
    for (qid, qtext), grp in df.groupby(["question_id", "question_text"]):
        total = len(grp)
        dist = grp["score"].value_counts(normalize=True) * 100
        cat = grp["category_name"].iloc[0] if "category_name" in grp else "Uncategorized"
        rows.append(
            {
                "question": qtext,
                "category": cat,
                "avg_score": round(grp["score"].mean(), 3),
                "n": int(total),
                "pct_1": round(dist.get(1, 0), 2),
                "pct_2": round(dist.get(2, 0), 2),
                "pct_3": round(dist.get(3, 0), 2),
                "pct_4": round(dist.get(4, 0), 2),
                "pct_5": round(dist.get(5, 0), 2),
            }
        )
    return pd.DataFrame(rows)


_DIM_COL = {
    "gender": "gender",
    "occupation": "occupation",
    "age_bucket": "age_bucket",
    "category": "category_name",
}


def demographic_breakdown(db: Session, survey_id: int, dim: str) -> pd.DataFrame:
    """Response count per category value (not score-weighted).

    Returns a 2-column DataFrame: [<dim>, responses]. Used by the Excel export
    to show how many respondents fell into each category.
    """
    df = load_responses_df(db, [survey_id])
    if df.empty:
        return pd.DataFrame()
    if dim == "age_bucket":
        df = df.copy()
        df["age_bucket"] = _bucketize(df["age"], load_age_buckets(db))
    col = _DIM_COL.get(dim, dim)
    g = df.groupby(col)["response_id"].nunique().reset_index()
    g.columns = [dim, "responses"]
    return g


def category_x_question_avg(db: Session, survey_id: int, dim: str) -> pd.DataFrame:
    """Rows = question text, columns = category values, cells = avg score."""
    df = load_responses_df(db, [survey_id])
    if df.empty:
        return pd.DataFrame()
    if dim == "age_bucket":
        df = df.copy()
        df["age_bucket"] = _bucketize(df["age"], load_age_buckets(db))
    col = _DIM_COL.get(dim, dim)
    pivot = df.pivot_table(
        index="question_text",
        columns=col,
        values="score",
        aggfunc="mean",
    ).round(3)
    pivot = pivot.reset_index().rename(columns={"question_text": "Question"})
    pivot.columns.name = None
    return pivot


def category_avg_scores(db: Session, survey_id: int) -> pd.DataFrame:
    """Per-category averages and response counts. Used by the Excel export."""
    df = load_responses_df(db, [survey_id])
    if df.empty:
        return pd.DataFrame()
    g = (
        df.groupby("category_name")
        .agg(avg_score=("score", "mean"), n_answers=("score", "size"))
        .reset_index()
        .rename(columns={"category_name": "Category"})
    )
    g["avg_score"] = g["avg_score"].round(3)
    return g


def raw_responses_df(db: Session, survey_id: int) -> pd.DataFrame:
    """Wide frame: one row per response, one column per question (score + comment)."""
    df = load_responses_df(db, [survey_id])
    if df.empty:
        return pd.DataFrame()
    meta_cols = ["response_id", "survey_title", "survey_period", "submitted_at",
                 "occupation", "gender", "age", "name"]
    meta = df.drop_duplicates("response_id")[meta_cols].set_index("response_id")

    scores = df.pivot_table(
        index="response_id",
        columns="question_text",
        values="score",
        aggfunc="first",
    ).add_prefix("Q: ")
    comments = df.pivot_table(
        index="response_id",
        columns="question_text",
        values="comment",
        aggfunc="first",
    ).add_prefix("Comment: ")
    wide = meta.join(scores).join(comments).reset_index(drop=True)
    return wide


def comparison_across_surveys(db: Session, survey_ids: list[int]) -> pd.DataFrame:
    """Per-question avg score across surveys (by period label)."""
    df = load_responses_df(db, survey_ids)
    if df.empty:
        return pd.DataFrame()
    pivot = df.pivot_table(
        index="question_text",
        columns=["survey_period", "survey_title"],
        values="score",
        aggfunc="mean",
    ).round(3)
    return pivot
