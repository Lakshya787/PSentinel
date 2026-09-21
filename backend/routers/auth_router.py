"""
routers/auth_router.py — Registration and Login endpoints.

POST /auth/register  { name, phone, password, role } → { access_token, token_type, user }
POST /auth/login     { phone, password }              → { access_token, token_type, user }
GET  /auth/me                                         → { user }  (requires Bearer token)

Rules (MVP):
  - Phone must be unique (DB UNIQUE constraint enforced).
  - No OTP, no email verification — user is trusted on creation.
  - Role is chosen at registration; valid values: FARMER | VET | DVO.
  - Password is bcrypt-hashed; never returned in any response.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from auth import (
    create_access_token,
    get_current_user,
    hash_password,
    user_to_dict,
    verify_password,
)
from db import get_db
from models import User

router = APIRouter(prefix="/auth", tags=["Auth"])

# ─── Pydantic schemas ─────────────────────────────────────────────────────────

VALID_ROLES = {"FARMER", "VET", "DVO"}


class RegisterIn(BaseModel):
    name:     str  = Field(..., min_length=2, max_length=120)
    phone:    str  = Field(..., min_length=7,  max_length=20)
    password: str  = Field(..., min_length=6,  max_length=128)
    role:     str  = Field("FARMER")

    @field_validator("role")
    @classmethod
    def _valid_role(cls, v: str) -> str:
        v = v.upper()
        if v not in VALID_ROLES:
            raise ValueError(f"role must be one of {sorted(VALID_ROLES)}")
        return v

    @field_validator("phone")
    @classmethod
    def _clean_phone(cls, v: str) -> str:
        # strip spaces / dashes / parentheses — keep digits and leading +
        cleaned = "".join(c for c in v if c.isdigit() or c == "+")
        if len(cleaned) < 7:
            raise ValueError("phone number too short")
        return cleaned


class LoginIn(BaseModel):
    phone:    str = Field(..., min_length=7, max_length=20)
    password: str = Field(..., min_length=1, max_length=128)


class TokenOut(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    user:         dict


# ─── Helpers ──────────────────────────────────────────────────────────────────

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


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("/register", response_model=TokenOut, status_code=201)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    """
    Create a new user account.  Returns a JWT on success.
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
    Authenticate with phone + password.  Returns a JWT on success.
    """
    # Normalise phone the same way registration does
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
