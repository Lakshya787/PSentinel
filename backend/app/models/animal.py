"""
app/models/animal.py — Animal and Vaccination ORM models (PostgreSQL edition).
"""

from __future__ import annotations

from sqlalchemy import Column, DateTime, Float, ForeignKey, String
from sqlalchemy.orm import relationship

from app.db.session import Base
from app.models._helpers import _uuid


class Animal(Base):
    """Individual livestock animal. tag_id is the primary key (ear-tag number)."""
    __tablename__ = "animals"

    tag_id     = Column(String(40), primary_key=True)   # e.g. "COW-1024"
    species    = Column(String(40), nullable=False)
    breed      = Column(String(80))
    age_years  = Column(Float)
    owner_name = Column(String(120))
    village_id = Column(String(36), ForeignKey("villages.id"))

    village      = relationship("Village",     back_populates="animals")
    vaccinations = relationship("Vaccination", back_populates="animal")
    reports      = relationship("Report",      back_populates="animal")


class Vaccination(Base):
    """Vaccination record linked to an individual animal."""
    __tablename__ = "vaccinations"

    id            = Column(String(36), primary_key=True, default=_uuid)
    animal_id     = Column(String(40), ForeignKey("animals.tag_id"), nullable=False)
    disease       = Column(String(80), nullable=False)
    vaccinated_on = Column(DateTime)

    animal = relationship("Animal", back_populates="vaccinations")
