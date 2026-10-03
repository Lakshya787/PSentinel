"""
app/models/report.py — Report (central disease-report) ORM model (PostgreSQL edition).

Central disease report row. Denormalises key animal/village fields for
fast API reads without joins. Spatial point stored as lat + lng Float columns
(Haversine computed in Python). JSONB used for symptoms, risk_factors, etc.
idempotency_key UNIQUE prevents duplicate rows when the frontend retries
a queued Background Sync request (ref.md §15).
"""
from __future__ import annotations

from sqlalchemy import (
    Column, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.db.session import Base
from app.models._helpers import _uuid, _now


class Report(Base):
    __tablename__ = "reports"
    __table_args__ = (
        UniqueConstraint("idempotency_key", name="uq_reports_idempotency_key"),
    )

    id              = Column(String(36), primary_key=True, default=_uuid)
    idempotency_key = Column(String(64), nullable=False, unique=True)

    # Human-readable case reference ("COW-1024", "CASE-1042", …)
    tag_id          = Column(String(40))

    # FK links (nullable — reports can arrive before animal/village records exist)
    animal_id       = Column(String(40), ForeignKey("animals.tag_id"))
    village_id      = Column(String(36), ForeignKey("villages.id"))

    # ── Denormalised animal fields ─────────────────────────────────────────────
    species          = Column(String(40))
    breed            = Column(String(80))
    age_years        = Column(Float)

    # ── Denormalised location fields ───────────────────────────────────────────
    village          = Column(String(120))
    taluk            = Column(String(120))
    district         = Column(String(120))
    state            = Column(String(120), default="Maharashtra")

    # ── Spatial point (Haversine computed in Python) ───────────────────────────
    lat              = Column(Float)   # WGS-84 latitude
    lng              = Column(Float)   # WGS-84 longitude

    # ── Clinical fields ────────────────────────────────────────────────────────
    syndrome         = Column(String(120))
    symptoms         = Column(JSONB, default=list)      # native list
    mortality        = Column(Integer, default=0)
    affected_animals = Column(Integer, default=1)
    photos           = Column(JSONB, default=list)      # native list

    # ── Workflow fields ────────────────────────────────────────────────────────
    reported_by      = Column(String(120))
    assigned_vet     = Column(String(80))
    status           = Column(String(40), default="REPORTED")
    risk_factors     = Column(JSONB)         # {clinical, vaccination, environmental, spatial}
    notes            = Column(Text, default="")
    tier1_triage     = Column(JSONB)         # Isolation Forest result

    # ── Timestamps ────────────────────────────────────────────────────────────
    created_at_client = Column(DateTime(timezone=True))   # device clock
    received_at       = Column(DateTime(timezone=True), default=_now)
    updated_at        = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    # ── Relationships ──────────────────────────────────────────────────────────
    animal            = relationship("Animal", back_populates="reports")
    village_rel       = relationship("Village", back_populates="reports")
    risk_assessment   = relationship("RiskAssessment", back_populates="report", uselist=False)
    lab_referral      = relationship("LabReferral", back_populates="report", uselist=False)
    containment_zones = relationship("ContainmentZone", back_populates="report")
    notifications     = relationship("Notification", back_populates="report")
