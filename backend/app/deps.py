from __future__ import annotations

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from . import auth, models
from .db import get_db


def current_admin(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> models.AdminUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    user_id = auth.read_token(token)
    if not user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    user = db.get(models.AdminUser, user_id)
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Account inactive")
    return user


def require_owner(user: models.AdminUser = Depends(current_admin)) -> models.AdminUser:
    if user.role != "owner":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Owner role required")
    return user
