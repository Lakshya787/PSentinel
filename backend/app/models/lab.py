"""
app/models/lab.py — LabReferral ORM model (PostgreSQL edition).
"""
from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.db.session import Base
from app.models._helpers import _uuid


class LabReferral(Base):
    __tablename__ = "lab_referrals"

    id           = Column(String(36), primary_key=True, default=_uuid)
    report_id    = Column(String(36), ForeignKey("reports.id"), nullable=False, unique=True)
    sample_types = Column(JSONB, default=list)   # native list
    status       = Column(String(40), default="PENDING")
    result       = Column(JSONB)                 # native result dict
    result_at    = Column(DateTime(timezone=True))

    report = relationship("Report", back_populates="lab_referral")
