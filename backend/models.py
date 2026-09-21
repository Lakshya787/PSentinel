"""
models.py — SQLAlchemy ORM for all 9 PostGIS tables (ref.md §9 schema).

Tables (in FK dependency order):
  villages → animals → vaccinations
  reports (FK: animals, villages)
  risk_assessments, lab_referrals, containment_zones → alerts
  notifications
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from geoalchemy2 import Geometry
from sqlalchemy import (
    Column, DateTime, Float, ForeignKey,
    Integer, Numeric, String, Text, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from db import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ─── villages ─────────────────────────────────────────────────────────────────
class Village(Base):
    """One row per village/hamlet. Spatial point + livestock census data."""
    __tablename__ = "villages"

    id               = Column(PG_UUID(as_uuid=False), primary_key=True, default=_uuid)
    name             = Column(String(120), nullable=False)
    taluk            = Column(String(120), nullable=False)
    district         = Column(String(120), nullable=False)
    state            = Column(String(120), nullable=False, default="Maharashtra")
    geom             = Column(Geometry("POINT", srid=4326))   # GIST index in migration
    livestock_count  = Column(Integer, default=0)
    fmd_vax_coverage = Column(Numeric(4, 3), default=0.0)     # 0.000–1.000

    animals  = relationship("Animal",  back_populates="village")
    reports  = relationship("Report",  back_populates="village_rel")


# ─── animals ──────────────────────────────────────────────────────────────────
class Animal(Base):
    """Individual livestock animal. tag_id is the primary key (ear-tag number)."""
    __tablename__ = "animals"

    tag_id     = Column(String(40), primary_key=True)   # e.g. "COW-1024"
    species    = Column(String(40), nullable=False)
    breed      = Column(String(80))
    age_years  = Column(Float)
    owner_name = Column(String(120))
    village_id = Column(PG_UUID(as_uuid=False), ForeignKey("villages.id"))

    village      = relationship("Village",     back_populates="animals")
    vaccinations = relationship("Vaccination", back_populates="animal")
    reports      = relationship("Report",      back_populates="animal")


# ─── vaccinations ─────────────────────────────────────────────────────────────
class Vaccination(Base):
    __tablename__ = "vaccinations"

    id            = Column(PG_UUID(as_uuid=False), primary_key=True, default=_uuid)
    animal_id     = Column(String(40), ForeignKey("animals.tag_id"), nullable=False)
    disease       = Column(String(80), nullable=False)
    vaccinated_on = Column(DateTime(timezone=True))

    animal = relationship("Animal", back_populates="vaccinations")


# ─── reports ──────────────────────────────────────────────────────────────────
class Report(Base):
    """
    Central disease report row. Denormalises key animal/village fields for
    fast API reads without joins. Spatial point stored as PostGIS geometry.

    idempotency_key UNIQUE prevents duplicate rows when the frontend retries
    a queued Background Sync request (ref.md §15).
    """
    __tablename__ = "reports"
    __table_args__ = (
        UniqueConstraint("idempotency_key", name="uq_reports_idempotency_key"),
    )

    id              = Column(PG_UUID(as_uuid=False), primary_key=True, default=_uuid)
    idempotency_key = Column(String(64), nullable=False, unique=True)

    # Human-readable case reference ("COW-1024", "CASE-1042", …)
    tag_id          = Column(String(40))

    # FK links (nullable — reports can arrive before animal/village records exist)
    animal_id       = Column(String(40), ForeignKey("animals.tag_id"))
    village_id      = Column(PG_UUID(as_uuid=False), ForeignKey("villages.id"))

    # ── Denormalised animal fields ────────────────────────────────────────────
    species          = Column(String(40))
    breed            = Column(String(80))
    age_years        = Column(Float)

    # ── Denormalised location fields ──────────────────────────────────────────
    village          = Column(String(120))
    taluk            = Column(String(120))
    district         = Column(String(120))
    state            = Column(String(120), default="Maharashtra")

    # ── PostGIS spatial point ─────────────────────────────────────────────────
    geom             = Column(Geometry("POINT", srid=4326))   # GIST index in migration

    # ── Clinical fields ───────────────────────────────────────────────────────
    syndrome         = Column(String(120))
    symptoms         = Column(JSONB, default=list)
    mortality        = Column(Integer, default=0)
    affected_animals = Column(Integer, default=1)
    photos           = Column(JSONB, default=list)

    # ── Workflow fields ───────────────────────────────────────────────────────
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

    # ── Relationships ─────────────────────────────────────────────────────────
    animal            = relationship("Animal", back_populates="reports")
    village_rel       = relationship("Village", back_populates="reports")
    risk_assessment   = relationship("RiskAssessment", back_populates="report", uselist=False)
    lab_referral      = relationship("LabReferral", back_populates="report", uselist=False)
    containment_zones = relationship("ContainmentZone", back_populates="report")
    notifications     = relationship("Notification", back_populates="report")


# ─── risk_assessments ─────────────────────────────────────────────────────────
class RiskAssessment(Base):
    """Persisted WLC composite risk score (ref.md §13). One per report."""
    __tablename__ = "risk_assessments"

    id          = Column(PG_UUID(as_uuid=False), primary_key=True, default=_uuid)
    report_id   = Column(PG_UUID(as_uuid=False), ForeignKey("reports.id"), nullable=False, unique=True)
    crs         = Column(Numeric(5, 2))    # composite risk score 0–100
    tier        = Column(String(20))       # CRITICAL / HIGH / MEDIUM / LOW
    factors     = Column(JSONB)            # per-factor scores and weights
    computed_at = Column(DateTime(timezone=True), default=_now)

    report = relationship("Report", back_populates="risk_assessment")


# ─── lab_referrals ────────────────────────────────────────────────────────────
class LabReferral(Base):
    __tablename__ = "lab_referrals"

    id           = Column(PG_UUID(as_uuid=False), primary_key=True, default=_uuid)
    report_id    = Column(PG_UUID(as_uuid=False), ForeignKey("reports.id"), nullable=False, unique=True)
    sample_types = Column(JSONB, default=list)
    status       = Column(String(40), default="PENDING")
    result       = Column(JSONB)
    result_at    = Column(DateTime(timezone=True))

    report = relationship("Report", back_populates="lab_referral")


# ─── containment_zones ────────────────────────────────────────────────────────
class ContainmentZone(Base):
    """
    3 km protection ring and 10 km surveillance ring as PostGIS Polygons.
    Computed via ST_Buffer(point::geography, meters)::geometry.
    """
    __tablename__ = "containment_zones"
    __table_args__ = (
        UniqueConstraint("report_id", "ring_km", name="uq_zone_report_ring"),
    )

    id         = Column(PG_UUID(as_uuid=False), primary_key=True, default=_uuid)
    report_id  = Column(PG_UUID(as_uuid=False), ForeignKey("reports.id"), nullable=False)
    ring_km    = Column(Integer, nullable=False)   # 3 or 10
    geom       = Column(Geometry("POLYGON", srid=4326))
    created_at = Column(DateTime(timezone=True), default=_now)

    report = relationship("Report", back_populates="containment_zones")
    alerts = relationship("Alert",  back_populates="zone")


# ─── alerts ───────────────────────────────────────────────────────────────────
class Alert(Base):
    """Multilingual farmer advisory linked to a containment zone."""
    __tablename__ = "alerts"

    id              = Column(PG_UUID(as_uuid=False), primary_key=True, default=_uuid)
    zone_id         = Column(PG_UUID(as_uuid=False), ForeignKey("containment_zones.id"), nullable=False)
    language        = Column(String(20))    # 'marathi', 'hindi', 'english'
    message         = Column(Text)
    recipient_count = Column(Integer, default=0)
    sent_at         = Column(DateTime(timezone=True))

    zone = relationship("ContainmentZone", back_populates="alerts")


# ─── notifications ────────────────────────────────────────────────────────────
class Notification(Base):
    """
    One-Health cross-notifications: IDSP, district Collector, market closure.
    ref.md §16 — Zoonotic dimension.
    """
    __tablename__ = "notifications"

    id         = Column(PG_UUID(as_uuid=False), primary_key=True, default=_uuid)
    type       = Column(String(40))           # IDSP / COLLECTOR / MARKET_CLOSURE
    report_id  = Column(PG_UUID(as_uuid=False), ForeignKey("reports.id"), nullable=False)
    payload    = Column(JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), default=_now)

    report = relationship("Report", back_populates="notifications")


# ─── users ────────────────────────────────────────────────────────────────────
class User(Base):
    """
    Auth user — phone + bcrypt password + role.
    No OTP / email verification (MVP).
    Roles: FARMER | VET | DVO
    """
    __tablename__ = "users"

    id            = Column(PG_UUID(as_uuid=False), primary_key=True, default=_uuid)
    name          = Column(String(120), nullable=False)
    phone         = Column(String(20), nullable=False, unique=True)
    password_hash = Column(String(128), nullable=False)
    role          = Column(String(20),  nullable=False, default="FARMER")  # FARMER | VET | DVO
    created_at    = Column(DateTime(timezone=True), default=_now)
