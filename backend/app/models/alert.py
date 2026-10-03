"""
app/models/alert.py — ContainmentZone, Alert, and Notification ORM models (PostgreSQL edition).

ContainmentZone: 3 km protection ring and 10 km surveillance ring stored as GeoJSON (JSONB).
Alert:           Multilingual farmer advisory linked to a containment zone.
Notification:    One-Health cross-notifications (ref.md §16 — zoonotic dimension).
"""
from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.db.session import Base
from app.models._helpers import _uuid, _now


class ContainmentZone(Base):
    """
    3 km protection ring and 10 km surveillance ring stored as GeoJSON Text.
    Circle polygon computed in Python (Haversine) at report submission time.
    """
    __tablename__ = "containment_zones"
    __table_args__ = (
        UniqueConstraint("report_id", "ring_km", name="uq_zone_report_ring"),
    )

    id         = Column(String(36), primary_key=True, default=_uuid)
    report_id  = Column(String(36), ForeignKey("reports.id"), nullable=False)
    ring_km    = Column(Integer, nullable=False)   # 3 or 10
    geojson    = Column(JSONB)                     # GeoJSON Polygon dict
    created_at = Column(DateTime(timezone=True), default=_now)

    report = relationship("Report", back_populates="containment_zones")
    alerts = relationship("Alert",  back_populates="zone")


class Alert(Base):
    """Multilingual farmer advisory linked to a containment zone."""
    __tablename__ = "alerts"

    id              = Column(String(36), primary_key=True, default=_uuid)
    zone_id         = Column(String(36), ForeignKey("containment_zones.id"), nullable=False)
    language        = Column(String(20))    # 'marathi', 'hindi', 'english'
    message         = Column(String)
    recipient_count = Column(Integer, default=0)
    sent_at         = Column(DateTime(timezone=True))

    zone = relationship("ContainmentZone", back_populates="alerts")


class Notification(Base):
    """
    One-Health cross-notifications: IDSP, district Collector, market closure.
    ref.md §16 — Zoonotic dimension.
    """
    __tablename__ = "notifications"

    id         = Column(String(36), primary_key=True, default=_uuid)
    type       = Column(String(40))           # IDSP / COLLECTOR / MARKET_CLOSURE
    report_id  = Column(String(36), ForeignKey("reports.id"), nullable=False)
    payload    = Column(JSONB, default=dict)  # native dict
    created_at = Column(DateTime(timezone=True), default=_now)

    report = relationship("Report", back_populates="notifications")
