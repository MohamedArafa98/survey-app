from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Auth / admins ----------

class BootstrapOut(BaseModel):
    first_run: bool


class SetupIn(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=6, max_length=128)


class LoginIn(BaseModel):
    username: str
    password: str


class LoginOut(BaseModel):
    token: str
    user: "AdminOut"


class AdminOut(ORMModel):
    id: int
    username: str
    role: str
    is_active: bool
    created_at: datetime


class AdminCreateIn(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=6, max_length=128)
    role: Literal["owner", "admin"] = "admin"


class AdminPatchIn(BaseModel):
    username: Optional[str] = Field(default=None, min_length=3, max_length=64)
    role: Optional[Literal["owner", "admin"]] = None
    is_active: Optional[bool] = None


class PasswordIn(BaseModel):
    current_password: Optional[str] = None
    new_password: str = Field(min_length=6, max_length=128)


# ---------- Surveys / questions ----------

SurveyState = Literal["draft", "open", "closed", "archived"]


class QuestionIn(BaseModel):
    text: str
    allow_comment: bool = False
    order_index: Optional[int] = None
    category_id: Optional[int] = None


class QuestionPatchIn(BaseModel):
    text: Optional[str] = None
    allow_comment: Optional[bool] = None
    order_index: Optional[int] = None
    category_id: Optional[int] = None


class QuestionOut(ORMModel):
    id: int
    survey_id: int
    text: str
    order_index: int
    scale_min: int
    scale_max: int
    allow_comment: bool
    category_id: Optional[int] = None


class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    order_index: Optional[int] = None


class CategoryPatchIn(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=128)
    order_index: Optional[int] = None


class CategoryOut(ORMModel):
    id: int
    survey_id: int
    name: str
    order_index: int


class CategoryReorderIn(BaseModel):
    order: list[int]


class SurveyIn(BaseModel):
    title: str
    description: str = ""
    period_label: str = ""


class SurveyPatchIn(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    period_label: Optional[str] = None


class SurveyStateIn(BaseModel):
    state: SurveyState


class SurveyOut(ORMModel):
    id: int
    title: str
    description: str
    period_label: str
    state: SurveyState
    created_at: datetime
    opened_at: Optional[datetime]
    closed_at: Optional[datetime]
    cloned_from_id: Optional[int]
    question_count: int = 0
    response_count: int = 0


class SurveyDetailOut(SurveyOut):
    questions: list[QuestionOut] = []
    categories: list[CategoryOut] = []


class QuestionReorderIn(BaseModel):
    order: list[int]  # list of question ids in new order


# ---------- Responses (guest) ----------

class AnswerIn(BaseModel):
    question_id: int
    score: int = Field(ge=1, le=5)
    comment: Optional[str] = None


class ResponseIn(BaseModel):
    occupation: str
    gender: Literal["male", "female"]
    age: int = Field(ge=10, le=110)
    name: Optional[str] = None
    answers: list[AnswerIn]


class ResponseOut(ORMModel):
    id: int
    survey_id: int
    submitted_at: datetime
    occupation: str
    gender: str
    age: int
    name: Optional[str]


class AnswerOut(ORMModel):
    id: int
    question_id: int
    score: int
    comment: Optional[str]


class ResponseWithAnswersOut(ResponseOut):
    answers: list[AnswerOut] = []


# ---------- Analytics ----------

class AnalyticsFilter(BaseModel):
    gender: Optional[list[str]] = None
    occupation: Optional[list[str]] = None
    age_buckets: Optional[list[str]] = None  # e.g. ["18-24","25-34"]


class AnalyticsQueryIn(BaseModel):
    survey_ids: list[int]
    metric: Literal["avg", "count", "percentage", "distribution"] = "avg"
    x_axis: Literal[
        "question", "survey", "gender", "occupation", "age_bucket", "score", "category"
    ] = "question"
    group_by: Optional[
        Literal[
            "gender", "occupation", "age_bucket", "survey", "question", "score", "category"
        ]
    ] = None
    filters: AnalyticsFilter = AnalyticsFilter()


class AnalyticsPoint(BaseModel):
    x: str | int
    y: float | int
    series: Optional[str] = None


class AnalyticsOut(BaseModel):
    points: list[AnalyticsPoint]
    series_names: list[str] = []
    x_labels: list[str | int] = []
    reason: Optional[str] = None


# ---------- Chart definitions ----------

class ChartDefIn(BaseModel):
    name: str
    survey_id: Optional[int] = None
    config_json: dict[str, Any]


class ChartDefOut(ORMModel):
    id: int
    survey_id: Optional[int]
    name: str
    config_json: dict
    created_at: datetime


# ---------- Settings ----------

class AgeBucket(BaseModel):
    label: str  # e.g. "18-24"
    min: int
    max: int


class AgeBucketsIn(BaseModel):
    buckets: list[AgeBucket]


class OccupationsIn(BaseModel):
    occupations: list[str]


class BoolSettingIn(BaseModel):
    enabled: bool


class BoolSettingOut(BaseModel):
    enabled: bool


# ---------- Export ----------

class ChartExportIn(BaseModel):
    name: str
    survey_ids: list[int]
    config_json: dict[str, Any]


class ExportIn(BaseModel):
    survey_ids: list[int]
    include_raw: bool = True
    include_aggregates: bool = True
    include_comparison: bool = True
    include_occupation_breakdown: bool = False
    charts: list[ChartExportIn] = []


LoginOut.model_rebuild()
