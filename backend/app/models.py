from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Index,
    JSON,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AdminUser(Base):
    __tablename__ = "admin_user"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(16), default="admin")  # owner|admin
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    created_by_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("admin_user.id", ondelete="SET NULL"), nullable=True
    )


class Setting(Base):
    __tablename__ = "setting"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value_json: Mapped[dict | list | str | int | float | bool | None] = mapped_column(JSON)


class AppMeta(Base):
    __tablename__ = "app_meta"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    first_run_complete: Mapped[bool] = mapped_column(Boolean, default=False)


class Survey(Base):
    __tablename__ = "survey"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="")
    period_label: Mapped[str] = mapped_column(String(64), default="")
    state: Mapped[str] = mapped_column(String(16), default="draft", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    opened_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    cloned_from_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("survey.id", ondelete="SET NULL"), nullable=True
    )
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")

    questions: Mapped[list["Question"]] = relationship(
        back_populates="survey",
        cascade="all, delete-orphan",
        order_by="Question.order_index",
    )
    categories: Mapped[list["QuestionCategory"]] = relationship(
        back_populates="survey",
        cascade="all, delete-orphan",
        order_by="QuestionCategory.order_index",
    )
    responses: Mapped[list["Response"]] = relationship(
        back_populates="survey", cascade="all, delete-orphan"
    )


class QuestionCategory(Base):
    __tablename__ = "question_category"

    id: Mapped[int] = mapped_column(primary_key=True)
    survey_id: Mapped[int] = mapped_column(ForeignKey("survey.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(128))
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    survey: Mapped[Survey] = relationship(back_populates="categories")
    questions: Mapped[list["Question"]] = relationship(
        back_populates="category", passive_deletes=True
    )


class Question(Base):
    __tablename__ = "question"

    id: Mapped[int] = mapped_column(primary_key=True)
    survey_id: Mapped[int] = mapped_column(ForeignKey("survey.id", ondelete="CASCADE"), index=True)
    category_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("question_category.id", ondelete="SET NULL"), nullable=True, index=True
    )
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    text: Mapped[str] = mapped_column(Text)
    scale_min: Mapped[int] = mapped_column(Integer, default=1)
    scale_max: Mapped[int] = mapped_column(Integer, default=5)
    allow_comment: Mapped[bool] = mapped_column(Boolean, default=False)

    survey: Mapped[Survey] = relationship(back_populates="questions")
    category: Mapped[Optional["QuestionCategory"]] = relationship(back_populates="questions")


class Response(Base):
    __tablename__ = "response"

    id: Mapped[int] = mapped_column(primary_key=True)
    survey_id: Mapped[int] = mapped_column(ForeignKey("survey.id", ondelete="CASCADE"), index=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    occupation: Mapped[str] = mapped_column(String(128))
    gender: Mapped[str] = mapped_column(String(16))  # male|female
    age: Mapped[int] = mapped_column(Integer)
    name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    survey: Mapped[Survey] = relationship(back_populates="responses")
    answers: Mapped[list["Answer"]] = relationship(
        back_populates="response", cascade="all, delete-orphan"
    )


class Answer(Base):
    __tablename__ = "answer"

    id: Mapped[int] = mapped_column(primary_key=True)
    response_id: Mapped[int] = mapped_column(
        ForeignKey("response.id", ondelete="CASCADE"), index=True
    )
    question_id: Mapped[int] = mapped_column(
        ForeignKey("question.id", ondelete="CASCADE"), index=True
    )
    score: Mapped[int] = mapped_column(Integer)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    response: Mapped[Response] = relationship(back_populates="answers")
    __table_args__ = (UniqueConstraint("response_id", "question_id", name="uq_answer_resp_q"),)


class ChartDef(Base):
    __tablename__ = "chart_def"

    id: Mapped[int] = mapped_column(primary_key=True)
    survey_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("survey.id", ondelete="CASCADE"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(128))
    config_json: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")


Index("ix_answer_response_question", Answer.response_id, Answer.question_id)
