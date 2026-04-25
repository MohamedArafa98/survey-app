from __future__ import annotations

import os
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker


def get_data_dir() -> Path:
    override = os.environ.get("SURVEYAPP_DATA_DIR")
    if override:
        path = Path(override)
    else:
        appdata = os.environ.get("APPDATA") or str(Path.home() / ".config")
        path = Path(appdata) / "SurveyApp"
    path.mkdir(parents=True, exist_ok=True)
    (path / "backups").mkdir(parents=True, exist_ok=True)
    return path


def get_db_path() -> Path:
    return get_data_dir() / "data.db"


def make_engine(db_path: Path | None = None):
    db_path = db_path or get_db_path()
    url = f"sqlite:///{db_path.as_posix()}"
    eng = create_engine(
        url,
        future=True,
        connect_args={"check_same_thread": False},
    )
    return eng


engine = make_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_schema_upgrades(eng: Engine = engine) -> None:
    """Idempotent additive schema patches for installs predating a model change.

    `Base.metadata.create_all()` creates missing tables but never adds new columns
    to existing tables. Keep this tiny and additive-only; no destructive changes.
    """
    with eng.begin() as conn:
        tables = {
            row[0]
            for row in conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table'")
            ).all()
        }
        if "question" in tables:
            cols = {
                row[1]
                for row in conn.execute(text("PRAGMA table_info(question)")).all()
            }
            if "category_id" not in cols:
                conn.execute(
                    text(
                        "ALTER TABLE question ADD COLUMN category_id INTEGER "
                        "REFERENCES question_category(id) ON DELETE SET NULL"
                    )
                )
                conn.execute(
                    text(
                        "CREATE INDEX IF NOT EXISTS ix_question_category_id "
                        "ON question (category_id)"
                    )
                )
