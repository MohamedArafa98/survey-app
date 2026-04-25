from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import auth, models, schemas
from ..db import get_db
from ..deps import current_admin


router = APIRouter(tags=["auth"])


@router.get("/bootstrap", response_model=schemas.BootstrapOut)
def bootstrap(db: Session = Depends(get_db)):
    meta = db.get(models.AppMeta, 1)
    done = bool(meta and meta.first_run_complete)
    return {"first_run": not done}


@router.post("/auth/setup", response_model=schemas.LoginOut)
def setup(body: schemas.SetupIn, db: Session = Depends(get_db)):
    meta = db.get(models.AppMeta, 1)
    if meta and meta.first_run_complete:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Already set up")
    if db.scalar(select(models.AdminUser).limit(1)):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Admin already exists")
    user = models.AdminUser(
        username=body.username,
        password_hash=auth.hash_password(body.password),
        role="owner",
        is_active=True,
    )
    db.add(user)
    if not meta:
        meta = models.AppMeta(id=1, first_run_complete=True)
        db.add(meta)
    else:
        meta.first_run_complete = True
    db.commit()
    db.refresh(user)
    token = auth.issue_token(user.id)
    return {"token": token, "user": user}


@router.post("/auth/login", response_model=schemas.LoginOut)
def login(body: schemas.LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(models.AdminUser).where(models.AdminUser.username == body.username))
    if not user or not user.is_active or not auth.verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")
    token = auth.issue_token(user.id)
    return {"token": token, "user": user}


@router.post("/auth/logout")
def logout(_: models.AdminUser = Depends(current_admin)):
    return {"ok": True}


@router.get("/auth/me", response_model=schemas.AdminOut)
def me(user: models.AdminUser = Depends(current_admin)):
    return user


@router.post("/auth/change-password")
def change_password(
    body: schemas.PasswordIn,
    db: Session = Depends(get_db),
    user: models.AdminUser = Depends(current_admin),
):
    if not body.current_password or not auth.verify_password(body.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Current password incorrect")
    user.password_hash = auth.hash_password(body.new_password)
    db.commit()
    return {"ok": True}
