"""
app/models/risk.py — RiskAssessment ORM model.

Persisted WLC composite risk score (ref.md §13). One per report.
"""
from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from app.db.session import Base
from app.models._helpers import _uuid, _now


class RiskAssessment(Base):
    __tablename__ = "risk_assessments"

    id          = Column(PG_UUID(as_uuid=False), primary_key=True, default=_uuid)
    report_id   = Column(PG_UUID(as_uuid=False), ForeignKey("reports.id"), nullable=False, unique=True)
    crs         = Column(Numeric(5, 2))    # composite risk score 0–100
    tier        = Column(String(20))       # CRITICAL / HIGH / MEDIUM / LOW
    factors     = Column(JSONB)            # per-factor scores and weights
    computed_at = Column(DateTime(timezone=True), default=_now)

    report = relationship("Report", back_populates="risk_assessment")
