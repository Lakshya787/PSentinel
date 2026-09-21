"""
auth.py — JWT + bcrypt auth utilities and FastAPI dependencies.

Environment variables (loaded from backend/.env):
  JWT_SECRET                   — HS256 signing key
  ACCESS_TOKEN_EXPIRE_MINUTES  — default 10080 (7 days, MVP-convenient)

Usage in routes:
  current_user = Depends(get_current_user)          # any logged-in user
  _            = Depends(require_role("VET","DVO"))  # role-gated
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from db import get_db
from models import User

# ─── Config ───────────────────────────────────────────────────────────────────
_JWT_SECRET  = os.getenv("JWT_SECRET", "pashu-sentinel-dev-secret-change-in-production")
_ALGORITHM   = "HS256"
_EXPIRE_MINS = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080"))  # 7 days

# ─── Password hashing ─────────────────────────────────────────────────────────
_pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(plain: str) -> str:
    return _pwd_ctx.hash(plain)

def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_ctx.verify(plain, hashed)

# ─── JWT helpers ──────────────────────────────────────────────────────────────
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Sign a JWT with user id, phone, name, role."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta if expires_delta else timedelta(minutes=_EXPIRE_MINS)
    )
    to_encode["exp"] = expire
    return jwt.encode(to_encode, _JWT_SECRET, algorithm=_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and verify a JWT; raises HTTPException 401 on failure."""
    try:
        payload = jwt.decode(token, _JWT_SECRET, algorithms=[_ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

# ─── FastAPI security scheme ──────────────────────────────────────────────────
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
      @app.post("/cases/{id}/action")
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
