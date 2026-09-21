"""
app/routers/reports.py — Field report submission router.
"""
from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.repositories import cases as case_repo
from app.repositories import spatial as spatial_repo
from app.schemas.report import FieldReportIn
from app.services.ml_engine import classify_syndrome, get_if_model

logger = logging.getLogger("pashu.reports")
router = APIRouter(tags=["Field Reports"])


def _clinical_score(symptoms: list[str], mortality: int) -> float:
    """Rough clinical risk sub-score from symptom count + mortality."""
    base = min(100.0, 30.0 + len(symptoms) * 10.0)
    if mortality > 0:
        base = min(100.0, base + 20.0)
    return round(base, 1)


@router.post("/reports", status_code=201)
def submit_report(
    report: FieldReportIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Accept a field report from a field worker.
    Automatically:
      - Classifies syndromic category
      - Runs Tier 1 Isolation Forest triage
      - Computes WLC composite risk score
      - Runs ST_DWithin spatial lag query
      - Creates 3 km + 10 km containment rings
      - Idempotent: same idempotency_key never creates a second row
    """
    tag_prefix = {
        "Cattle": "COW", "Buffalo": "BUF", "Goat": "GOAT", "Sheep": "SHP"
    }.get(report.species, "ANM")
    tag_id    = report.tag_id or f"{tag_prefix}-{uuid.uuid4().hex[:4].upper()}"
    idem_key  = report.idempotency_key or str(uuid.uuid4())
    syndrome  = classify_syndrome(report.symptoms)

    # ── Spatial lag: ST_DWithin neighbours → spatial risk factor ─────────────
    neighbours = spatial_repo.neighbouring_reports(
        db, lat=report.lat, lon=report.lng,
        syndrome=syndrome, radius_m=15_000, days=4,
    )
    spatial_score = spatial_repo.compute_spatial_risk_factor(neighbours)

    # ── Nearest village: livestock density + FMD coverage ────────────────────
    nearest = spatial_repo.nearest_village(db, lat=report.lat, lon=report.lng)
    vax_coverage = nearest["fmd_vax_coverage"] if nearest else 0.7
    vax_score = round((1 - vax_coverage) * 100, 1)

    risk_factors = (
        report.risk_factors.model_dump() if report.risk_factors
        else {
            "clinical":      _clinical_score(report.symptoms, report.mortality),
            "vaccination":   vax_score,
            "environmental": 60.0,
            "spatial":       spatial_score,
        }
    )

    # ── Tier 1 Auto-Triage ────────────────────────────────────────────────────
    case_preview = {
        "tag_id": tag_id, "species": report.species,
        "symptoms": report.symptoms, "mortality": report.mortality,
        "risk_factors": risk_factors,
    }
    tier1_result = {"anomaly_score": 0.5, "is_anomalous": False, "decision": "UNTRAINED"}
    if_model = get_if_model()
    if if_model and if_model._trained:
        tier1_result = if_model.score(case_preview)

    status = "RISK_ANALYZED" if tier1_result.get("is_anomalous") else "REPORTED"

    # ── Idempotent DB insert ──────────────────────────────────────────────────
    data = {
        "tag_id":           tag_id,
        "idempotency_key":  idem_key,
        "species":          report.species,
        "breed":            report.breed,
        "age_years":        report.age_years,
        "village":          report.village,
        "taluk":            report.taluk,
        "district":         report.district,
        "state":            report.state,
        "lat":              report.lat,
        "lng":              report.lng,
        "syndrome":         syndrome,
        "symptoms":         report.symptoms,
        "mortality":        report.mortality,
        "affected_animals": report.affected_animals,
        "reported_by":      report.reported_by,
        "status":           status,
        "risk_factors":     risk_factors,
        "notes":            report.notes or "",
    }
    case_dict, is_new = case_repo.create_report(db, data, tier1_result)

    # ── Containment rings (only for new reports) ──────────────────────────────
    rings = []
    if is_new:
        report_orm = case_repo.get_report_orm(db, case_dict["tag_id"] or case_dict["id"])
        if report_orm:
            rings = spatial_repo.create_containment_rings(
                db, report_id=str(report_orm.id),
                lat=report.lat, lon=report.lng,
            )
        if tier1_result.get("is_anomalous"):
            logger.info(
                f"[Tier 1] ANOMALY flagged for {tag_id} "
                f"(score={tier1_result['anomaly_score']:.4f})"
            )

    return {
        "case_id":             case_dict["tag_id"] or case_dict["id"],
        "is_new":              is_new,
        "case":                case_dict,
        "tier1_triage":        tier1_result,
        "syndrome_classified": syndrome,
        "neighbours_found":    len(neighbours),
        "containment_rings":   rings,
    }
