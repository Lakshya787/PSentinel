"""
app/schemas/common.py — Shared Pydantic base schemas and enumerations.
"""
from __future__ import annotations

from enum import Enum


class RoleEnum(str, Enum):
    FARMER = "FARMER"
    VET    = "VET"
    DVO    = "DVO"


class StatusEnum(str, Enum):
    REPORTED            = "REPORTED"
    RISK_ANALYZED       = "RISK_ANALYZED"
    UNDER_INVESTIGATION = "UNDER_INVESTIGATION"
    LAB_TESTING         = "LAB_TESTING"
    LAB_CONFIRMED       = "LAB_CONFIRMED"
    ALERT_SENT          = "ALERT_SENT"
    CONTAINMENT         = "CONTAINMENT"
