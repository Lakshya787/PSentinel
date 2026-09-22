"""
app/models/lab.py — LabReferral ORM model (SQLite edition).

JSONB replaced with Text (JSON-encoded).
"""
from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from app.db.session import Base
from app.models._helpers import _uuid


class LabReferral(Base):
    __tablename__ = "lab_referrals"

    id           = Column(String(36), primary_key=True, default=_uuid)
    report_id    = Column(String(36), ForeignKey("reports.id"), nullable=False, unique=True)
    sample_types = Column(Text, default="[]")   # JSON-encoded list
    status       = Column(String(40), default="PENDING")
    result       = Column(Text)                 # JSON-encoded result
    result_at    = Column(DateTime)

    report = relationship("Report", back_populates="lab_referral")
