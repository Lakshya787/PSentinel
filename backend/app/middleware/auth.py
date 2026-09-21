"""
app/middleware/auth.py — FastAPI auth dependencies.

Provides get_current_user and require_role factory, using security helpers
from app.core.security to avoid circular imports.
"""
from __future__ import annotations

from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.session import get_db
from app.models.user import User

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    """
    Decode the Bearer token and return the matching User ORM row.
    Raises 401 if token is missing, invalid, or the user no longer exists.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_token(credentials.credentials)
    user_id: str | None = payload.get("sub")
    if not user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token payload.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found.")
    return user


def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """
    Like get_current_user but returns None instead of raising 401.
    Use on read endpoints that are open but still want to know who is asking.
    """
    if not credentials:
        return None
    try:
        payload = decode_token(credentials.credentials)
        user_id = payload.get("sub")
        if not user_id:
            return None
        return db.query(User).filter(User.id == user_id).first()
    except HTTPException:
        return None


def require_role(*roles: str):
    """
    Factory that returns a dependency checking the current user's role.

    Usage:
        @router.post("/cases/{id}/action")
        def action(..., _=Depends(require_role("VET", "DVO"))):
            ...
    """
    def _check(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Access denied. Required role: {' or '.join(roles)}. "
                    f"Your role: {current_user.role}."
                ),
            )
        return current_user
    return _check


def user_to_dict(user: User) -> dict:
    """Safe serialisation — never includes password_hash."""
    return {
        "id":         user.id,
        "name":       user.name,
        "phone":      user.phone,
        "role":       user.role,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }
