"""
app/services/risk_engine.py — Deterministic WLC composite risk scoring.

Formula: Clinical×0.30 + Vaccination×0.25 + Environmental×0.25 + Spatial×0.20
Example: {clinical:92, vaccination:80, environmental:85, spatial:95} → 88 CRITICAL
"""
from __future__ import annotations

WEIGHTS = {
    "clinical":      0.30,
    "vaccination":   0.25,
    "environmental": 0.25,
    "spatial":       0.20,
}

RISK_LEVELS = [
    (80, "CRITICAL"),
    (60, "HIGH"),
    (40, "MEDIUM"),
    (0,  "LOW"),
]

SYNDROME_MAP = {
    "CRITICAL": "Vesicular / Podal Syndrome",
    "HIGH":     "Respiratory / Systemic Syndrome",
    "MEDIUM":   "Gastrointestinal Syndrome",
    "LOW":      "Non-specific Syndrome",
}


def calculate_risk(
    clinical: float,
    vaccination: float,
    environmental: float,
    spatial: float,
) -> dict:
    """
    Calculate composite risk score from four sub-scores (0-100 each).

    Returns a dict with:
        score      (int)   — composite 0–100
        level      (str)   — CRITICAL / HIGH / MEDIUM / LOW
        syndrome   (str)   — suspected syndrome label
        factors    (dict)  — echo of input factors
    """
    raw = (
        clinical      * WEIGHTS["clinical"] +
        vaccination   * WEIGHTS["vaccination"] +
        environmental * WEIGHTS["environmental"] +
        spatial       * WEIGHTS["spatial"]
    )
    score = round(raw)

    level = "LOW"
    for threshold, lbl in RISK_LEVELS:
        if score >= threshold:
            level = lbl
            break

    return {
        "score":    score,
        "level":    level,
        "syndrome": SYNDROME_MAP[level],
        "factors": {
            "clinical":      clinical,
            "vaccination":   vaccination,
            "environmental": environmental,
            "spatial":       spatial,
        },
    }
