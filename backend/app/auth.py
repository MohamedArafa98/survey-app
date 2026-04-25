from __future__ import annotations

import os
import secrets
from datetime import timedelta
from pathlib import Path

from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from passlib.context import CryptContext

from .db import get_data_dir


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SESSION_MAX_AGE_SECONDS = int(timedelta(hours=12).total_seconds())


def _secret_key() -> str:
    env = os.environ.get("SURVEYAPP_SECRET")
    if env:
        return env
    secret_path: Path = get_data_dir() / ".secret"
    if secret_path.exists():
        return secret_path.read_text().strip()
    value = secrets.token_urlsafe(48)
    secret_path.write_text(value)
    try:
        os.chmod(secret_path, 0o600)
    except OSError:
        pass
    return value


_serializer: URLSafeTimedSerializer | None = None


def serializer() -> URLSafeTimedSerializer:
    global _serializer
    if _serializer is None:
        _serializer = URLSafeTimedSerializer(_secret_key(), salt="surveyapp.session")
    return _serializer


def hash_password(pw: str) -> str:
    return pwd_context.hash(pw)


def verify_password(pw: str, hashed: str) -> bool:
    return pwd_context.verify(pw, hashed)


def issue_token(user_id: int) -> str:
    return serializer().dumps({"uid": user_id})


def read_token(token: str) -> int | None:
    try:
        data = serializer().loads(token, max_age=SESSION_MAX_AGE_SECONDS)
    except (BadSignature, SignatureExpired):
        return None
    uid = data.get("uid")
    return int(uid) if uid is not None else None
