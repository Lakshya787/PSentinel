"""
app/models/user.py — User ORM model (PostgreSQL edition).

Auth user — phone + bcrypt password + role.
No OTP / email verification (MVP).
Roles: FARMER | VET | DVO
"""
from __future__ import annotations

from sqlalchemy import Column, DateTime, String

from app.db.session import Base
from app.models._helpers import _uuid, _now


class User(Base):
    __tablename__ = "users"

    id            = Column(String(36), primary_key=True, default=_uuid)
    name          = Column(String(120), nullable=False)
    phone         = Column(String(20), nullable=False, unique=True)
    password_hash = Column(String(128), nullable=False)
    role          = Column(String(20), nullable=False, default="FARMER")  # FARMER | VET | DVO
    created_at    = Column(DateTime(timezone=True), default=_now)
