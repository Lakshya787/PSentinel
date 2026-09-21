"""
app/schemas/case.py — Pydantic schemas for case lifecycle actions.
"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class ActionIn(BaseModel):
    action:  str
    vet_id:  Optional[str] = None
    notes:   Optional[str] = ""
