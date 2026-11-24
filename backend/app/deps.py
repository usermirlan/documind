from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .db import get_db
from .i18n import t
from .models import User
from .security import decode_token

bearer = HTTPBearer(auto_error=False)


def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)
) -> User:
    payload = decode_token(creds.credentials) if creds else None
    user = db.get(User, int(payload["sub"])) if payload else None
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, t("Кирүү талап кылынат"))
    return user


def not_found() -> HTTPException:
    return HTTPException(status.HTTP_404_NOT_FOUND, t("Табылган жок"))
