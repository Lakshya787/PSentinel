"""
app/models/lab.py — LabReferral ORM model.
"""
from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from app.db.session import Base
from app.models._helpers import _uuid


class LabReferral(Base):
    __tablename__ = "lab_referrals"

    id           = Column(PG_UUID(as_uuid=False), primary_key=True, default=_uuid)
    report_id    = Column(PG_UUID(as_uuid=False), ForeignKey("reports.id"), nullable=False, unique=True)
    sample_types = Column(JSONB, default=list)
    status       = Column(String(40), default="PENDING")
    result       = Column(JSONB)
    result_at    = Column(DateTime(timezone=True))

    report = relationship("Report", back_populates="lab_referral")
