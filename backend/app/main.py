from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import models
from .db import Base, engine, ensure_schema_upgrades
from .routers import (
    admins,
    analytics,
    auth as auth_router,
    categories,
    charts,
    demographics,
    export,
    questions,
    responses,
    surveys,
)


DEFAULT_OCCUPATIONS = [
    "Student",
    "Teacher",
    "Engineer",
    "Doctor",
    "Nurse",
    "Manager",
    "Sales",
    "Retired",
    "Unemployed",
]

DEFAULT_AGE_BUCKETS = [
    {"label": "18-24", "min": 18, "max": 24},
    {"label": "25-34", "min": 25, "max": 34},
    {"label": "35-44", "min": 35, "max": 44},
    {"label": "45-54", "min": 45, "max": 54},
    {"label": "55+", "min": 55, "max": 200},
]


def seed_settings_if_missing():
    from .db import SessionLocal

    with SessionLocal() as db:
        if not db.get(models.AppMeta, 1):
            db.add(models.AppMeta(id=1, first_run_complete=False))
        if not db.get(models.Setting, "occupations"):
            db.add(models.Setting(key="occupations", value_json=DEFAULT_OCCUPATIONS))
        if not db.get(models.Setting, "age_buckets"):
            db.add(models.Setting(key="age_buckets", value_json=DEFAULT_AGE_BUCKETS))
        if not db.get(models.Setting, "allow_other_occupation"):
            db.add(models.Setting(key="allow_other_occupation", value_json=True))
        db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_schema_upgrades(engine)
    seed_settings_if_missing()
    yield


app = FastAPI(title="SurveyApp", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router, prefix="/api")
app.include_router(admins.router, prefix="/api")
app.include_router(surveys.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(questions.router, prefix="/api")
app.include_router(responses.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(charts.router, prefix="/api")
app.include_router(demographics.router, prefix="/api")
app.include_router(export.router, prefix="/api")


STATIC_DIR = Path(__file__).parent / "static"
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        target = STATIC_DIR / full_path
        if full_path and target.is_file():
            return FileResponse(target)
        return FileResponse(STATIC_DIR / "index.html")
