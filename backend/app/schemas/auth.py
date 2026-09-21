"""
app/schemas/auth.py — Pydantic schemas for auth endpoints.
"""
from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

VALID_ROLES = {"FARMER", "VET", "DVO"}


class RegisterIn(BaseModel):
    name:     str = Field(..., min_length=2, max_length=120)
    phone:    str = Field(..., min_length=7,  max_length=20)
    password: str = Field(..., min_length=6,  max_length=128)
    role:     str = Field("FARMER")

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
