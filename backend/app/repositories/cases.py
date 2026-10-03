"""
app/repositories/cases.py — Case (Report) CRUD using SQLAlchemy ORM.

PostgreSQL edition:
  - JSONB columns return native Python dicts/lists — no json.loads/dumps needed.
  - Geometry stored as plain lat/lng Float fields; Haversine in Python.
  - Idempotent insert: check-by-idempotency_key then insert.

report_to_dict() converts ORM rows → the exact JSON shape all existing API
routes return — no frontend response-shape changes required.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.report import Report
from app.models.risk import RiskAssessment
from app.services.risk_engine import calculate_risk

LIFECYCLE = [
    "REPORTED", "RISK_ANALYZED", "UNDER_INVESTIGATION",
    "LAB_TESTING", "LAB_CONFIRMED", "ALERT_SENT", "CONTAINMENT",
]


# ─── Response serialiser ──────────────────────────────────────────────────────

def report_to_dict(r: Report) -> dict:
    """
    Convert ORM Report row → the exact dict shape all existing API routes return.
    No frontend response-shape changes required.
    JSONB columns are already native dicts/lists — no json.loads needed.
    """
    rf = r.risk_factors or {}
    risk = calculate_risk(**rf) if len(rf) == 4 else None

    return {
        "id":               r.tag_id or str(r.id),
        "tag_id":           r.tag_id or str(r.id),
        "species":          r.species,
        "breed":            r.breed,
        "age_years":        r.age_years,
        "village":          r.village,
        "taluk":            r.taluk,
        "district":         r.district,
        "state":            r.state,
        "lat":              r.lat,
        "lng":              r.lng,
        "symptoms":         r.symptoms or [],
        "mortality":        r.mortality,
        "affected_animals": r.affected_animals,
        "reported_by":      r.reported_by,
        "assigned_vet":     r.assigned_vet,
        "status":           r.status,
        "syndrome":         r.syndrome,
        "risk_factors":     rf,
        "risk":             risk,
        "reported_at": (
            r.created_at_client.isoformat() if r.created_at_client
            else (r.received_at.isoformat() if r.received_at else None)
        ),
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        "notes":       r.notes or "",
        "tier1_triage": r.tier1_triage,
    }


# ─── Queries ──────────────────────────────────────────────────────────────────

def list_reports(
    db: Session,
    status:  Optional[str] = None,
    species: Optional[str] = None,
    limit:   int = 100,
) -> list[dict]:
    q = db.query(Report)
    if status:
        q = q.filter(Report.status == status.upper())
    if species:
        q = q.filter(Report.species.ilike(f"%{species}%"))
    rows = q.order_by(Report.received_at.desc()).limit(limit).all()
    result = [report_to_dict(r) for r in rows]
    # sort by risk score descending (matching old behaviour)
    result.sort(
        key=lambda c: (c.get("risk") or {}).get("score", 0),
        reverse=True,
    )
    return result


def get_report_orm(db: Session, case_id: str) -> Optional[Report]:
    """Lookup by tag_id (friendly) OR internal UUID."""
    return db.query(Report).filter(
        (Report.tag_id == case_id) | (Report.id == case_id)
    ).first()


def get_report(db: Session, case_id: str) -> Optional[dict]:
    r = get_report_orm(db, case_id)
    return report_to_dict(r) if r else None


# ─── Idempotent insert ────────────────────────────────────────────────────────

def create_report(
    db: Session,
    data: dict,
    tier1_result: Optional[dict] = None,
) -> tuple[dict, bool]:
    """
    Idempotent report insert — checks idempotency_key first.

    Returns (report_dict, is_new):
      is_new=False when the idempotency_key already existed (replay detected).
    """
    idem_key = data.get("idempotency_key") or str(uuid.uuid4())
    now      = datetime.now(timezone.utc)

    # Check for existing row (idempotency)
    existing = db.query(Report).filter(Report.idempotency_key == idem_key).first()
    if existing:
        return report_to_dict(existing), False

    new_report = Report(
        id               = str(uuid.uuid4()),
        idempotency_key  = idem_key,
        tag_id           = data.get("tag_id"),
        species          = data.get("species"),
        breed            = data.get("breed"),
        age_years        = data.get("age_years"),
        village          = data.get("village"),
        taluk            = data.get("taluk"),
        district         = data.get("district"),
        state            = data.get("state", "Maharashtra"),
        lat              = data.get("lat"),
        lng              = data.get("lng"),
        syndrome         = data.get("syndrome"),
        symptoms         = data.get("symptoms", []),       # JSONB — pass list directly
        mortality        = data.get("mortality", 0),
        affected_animals = data.get("affected_animals", 1),
        reported_by      = data.get("reported_by"),
        assigned_vet     = data.get("assigned_vet"),
        status           = data.get("status", "REPORTED"),
        risk_factors     = data.get("risk_factors", {}),   # JSONB — pass dict directly
        notes            = data.get("notes", ""),
        tier1_triage     = tier1_result or {},             # JSONB — pass dict directly
        created_at_client= now,
        received_at      = now,
        updated_at       = now,
    )
    db.add(new_report)
    db.commit()
    db.refresh(new_report)

    # Persist risk assessment
    rf = data.get("risk_factors")
    if rf and len(rf) == 4:
        risk = calculate_risk(**rf)
        ra = RiskAssessment(
            id          = str(uuid.uuid4()),
            report_id   = new_report.id,
            crs         = risk["score"],
            tier        = risk["level"],
            factors     = rf,      # JSONB — pass dict directly
            computed_at = now,
        )
        db.add(ra)
        db.commit()

    return report_to_dict(new_report), True


# ─── Lifecycle mutations ──────────────────────────────────────────────────────

def advance_status(db: Session, case_id: str, note: str = "") -> Optional[dict]:
    r = get_report_orm(db, case_id)
    if not r:
        return None
    idx = LIFECYCLE.index(r.status) if r.status in LIFECYCLE else -1
    if idx == -1 or idx >= len(LIFECYCLE) - 1:
        return "FINAL"   # sentinel — caller raises 400
    r.status = LIFECYCLE[idx + 1]
    r.updated_at = datetime.now(timezone.utc)
    if note:
        r.notes = f"{r.notes or ''}\n[{r.status}] {note}".strip()
    db.commit()
    return report_to_dict(r)


def assign_vet(db: Session, case_id: str, vet_id: str) -> Optional[dict]:
    r = get_report_orm(db, case_id)
    if not r:
        return None
    r.assigned_vet = vet_id
    r.updated_at   = datetime.now(timezone.utc)
    db.commit()
    return report_to_dict(r)
