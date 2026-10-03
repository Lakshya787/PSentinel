"""
app/models/village.py — Village ORM model (PostgreSQL edition).

Spatial point stored as two plain Float columns (lat, lng).
Haversine distance computed in Python (app/repositories/spatial.py).
"""

from __future__ import annotations

from sqlalchemy import Column, Float, Integer, Numeric, String
from sqlalchemy.orm import relationship

from app.db.session import Base
from app.models._helpers import _uuid


class Village(Base):
    """One row per village/hamlet. lat/lng + livestock census data."""
    __tablename__ = "villages"

    id               = Column(String(36), primary_key=True, default=_uuid)
    name             = Column(String(120), nullable=False)
    taluk            = Column(String(120), nullable=False)
    district         = Column(String(120), nullable=False)
    state            = Column(String(120), nullable=False, default="Maharashtra")
    lat              = Column(Float)      # WGS-84 latitude
    lng              = Column(Float)      # WGS-84 longitude
    livestock_count  = Column(Integer, default=0)
    fmd_vax_coverage = Column(Numeric(4, 3), default=0.0)   # 0.000–1.000

    animals  = relationship("Animal",  back_populates="village")
    reports  = relationship("Report",  back_populates="village_rel")
