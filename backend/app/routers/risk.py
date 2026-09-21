"""
app/routers/risk.py — Risk assessment & 3-Tier ML pipeline router.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.repositories import cases as case_repo
from app.services.ml_engine import (
    get_ewma_model,
    get_if_model,
    run_three_tier_pipeline,
)
from app.services.risk_engine import calculate_risk

router = APIRouter(tags=["Risk", "Intelligence"])


@router.get("/risk/{case_id}")
def get_risk(case_id: str, db: Session = Depends(get_db)):
    """Return WLC composite risk score for a case (ref.md §13)."""
    case = case_repo.get_report(db, case_id)
    if not case:
        raise HTTPException(404, f"Case '{case_id}' not found.")
    rf = case.get("risk_factors", {})
    if not rf or len(rf) < 4:
        raise HTTPException(422, "No risk factors recorded for this case.")
    return {"case_id": case_id, "risk": calculate_risk(**rf)}


@router.get("/analyze/{case_id}")
def analyze_case(case_id: str, db: Session = Depends(get_db)):
    """
    Run the full Three-Tier ML Intelligence Pipeline on a case (ref.md §10).
    """
    case = case_repo.get_report(db, case_id)
    if not case:
        raise HTTPException(404, f"Case '{case_id}' not found.")

    if_model = get_if_model()
    ewma_model = get_ewma_model()
    if if_model is None or ewma_model is None:
        raise HTTPException(503, "ML engine not yet initialised. Retry in a moment.")

    all_cases = case_repo.list_reports(db, limit=500)
    return run_three_tier_pipeline(case, if_model, ewma_model, all_cases)
