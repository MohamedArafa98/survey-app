from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import auth, models, schemas
from ..db import get_db
from ..deps import current_admin


router = APIRouter(prefix="/admins", tags=["admins"])


@router.get("", response_model=list[schemas.AdminOut])
def list_admins(db: Session = Depends(get_db), _: models.AdminUser = Depends(current_admin)):
    return db.scalars(select(models.AdminUser).order_by(models.AdminUser.id)).all()


@router.post("", response_model=schemas.AdminOut, status_code=201)
def create_admin(
    body: schemas.AdminCreateIn,
    db: Session = Depends(get_db),
    me: models.AdminUser = Depends(current_admin),
):
    if body.role == "owner" and me.role != "owner":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only an owner can create another owner")
    if db.scalar(select(models.AdminUser).where(models.AdminUser.username == body.username)):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Username already exists")
    user = models.AdminUser(
        username=body.username,
        password_hash=auth.hash_password(body.password),
        role=body.role,
        is_active=True,
        created_by_id=me.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{admin_id}", response_model=schemas.AdminOut)
def patch_admin(
    admin_id: int,
    body: schemas.AdminPatchIn,
    db: Session = Depends(get_db),
    me: models.AdminUser = Depends(current_admin),
):
    user = db.get(models.AdminUser, admin_id)
    if not user:
        raise HTTPException(404, "Not found")
    if body.role is not None and body.role != user.role and me.role != "owner":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only an owner can change roles")
    if body.is_active is False and user.role == "owner":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot deactivate the owner")
    if body.username and body.username != user.username:
        if db.scalar(select(models.AdminUser).where(models.AdminUser.username == body.username)):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Username already exists")
        user.username = body.username
    if body.role is not None:
        user.role = body.role
    if body.is_active is not None:
        user.is_active = body.is_active
    db.commit()
    db.refresh(user)
    return user


@router.post("/{admin_id}/reset-password")
def reset_password(
    admin_id: int,
    body: schemas.PasswordIn,
    db: Session = Depends(get_db),
    me: models.AdminUser = Depends(current_admin),
):
    user = db.get(models.AdminUser, admin_id)
    if not user:
        raise HTTPException(404, "Not found")
    if me.id != user.id and me.role != "owner":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only an owner can reset other admins")
    user.password_hash = auth.hash_password(body.new_password)
    db.commit()
    return {"ok": True}


@router.delete("/{admin_id}")
def delete_admin(
    admin_id: int,
    db: Session = Depends(get_db),
    me: models.AdminUser = Depends(current_admin),
):
    user = db.get(models.AdminUser, admin_id)
    if not user:
        raise HTTPException(404, "Not found")
    if user.role == "owner":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot delete the owner")
    if me.id == user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cannot delete yourself")
    user.is_active = False
    db.commit()
    return {"ok": True}
