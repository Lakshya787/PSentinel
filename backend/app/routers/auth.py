"""
app/routers/auth.py — Auth endpoints (Register, Login, Me).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.middleware.auth import get_current_user, user_to_dict

from app.models.user import User
from app.schemas.auth import LoginIn, RegisterIn, TokenOut

router = APIRouter(prefix="/auth", tags=["Auth"])


def _make_token_response(user: User) -> dict:
    token = create_access_token({
        "sub":   user.id,
        "name":  user.name,
        "phone": user.phone,
        "role":  user.role,
    })
    return {
        "access_token": token,
        "token_type":   "bearer",
        "user":         user_to_dict(user),
    }


@router.post("/register", response_model=TokenOut, status_code=201)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    """
    Create a new user account. Returns a JWT on success.
    Phone number must be unique — 409 if already registered.
    """
    new_user = User(
        id            = str(uuid.uuid4()),
        name          = body.name.strip(),
        phone         = body.phone,
        password_hash = hash_password(body.password),
        role          = body.role,
        created_at    = datetime.now(timezone.utc),
    )
    db.add(new_user)
    try:
        db.commit()
        db.refresh(new_user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this phone number already exists. Please log in instead.",
        )
    return _make_token_response(new_user)


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    """
    Authenticate with phone + password. Returns a JWT on success.
    """
    cleaned_phone = "".join(c for c in body.phone if c.isdigit() or c == "+")

    user = db.query(User).filter(User.phone == cleaned_phone).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect phone number or password.",
        )
    return _make_token_response(user)


@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    """Return the profile of the currently authenticated user."""
    return {"user": user_to_dict(current_user)}
