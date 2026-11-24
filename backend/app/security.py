from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from .config import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except ValueError:
        return False


def create_token(user_id: int, *, scope: str = "user", ttl: timedelta | None = None, **claims) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "scope": scope,
        "iat": now,
        "exp": now + (ttl or timedelta(hours=settings.token_ttl_hours)),
        **claims,
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def decode_token(token: str, scope: str = "user") -> dict | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    return payload if payload.get("scope") == scope else None
