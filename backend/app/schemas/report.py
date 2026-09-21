"""
app/schemas/report.py — Pydantic schemas for field report submission.
"""
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel


class RiskFactors(BaseModel):
    clinical:      float
    vaccination:   float
    environmental: float
    spatial:       float


class FieldReportIn(BaseModel):
    tag_id:           Optional[str]   = None
    idempotency_key:  Optional[str]   = None
    species:          str
    breed:            Optional[str]   = None
    age_years:        Optional[float] = None
    village:          str
    taluk:            str
    district:         str
    state:            str             = "Maharashtra"
    lat:              float
    lng:              float
    symptoms:         List[str]
    mortality:        int             = 0
    affected_animals: int             = 1
    reported_by:      str
    notes:            Optional[str]   = ""
    risk_factors:     Optional[RiskFactors] = None
