"""
app/models/alert.py — ContainmentZone, Alert, and Notification ORM models.

ContainmentZone: 3 km protection ring and 10 km surveillance ring as PostGIS Polygons.
Alert:           Multilingual farmer advisory linked to a containment zone.
Notification:    One-Health cross-notifications (ref.md §16 — zoonotic dimension).
"""
from __future__ import annotations

from geoalchemy2 import Geometry
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from app.db.session import Base
from app.models._helpers import _uuid, _now


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
