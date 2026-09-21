"""
app/repositories/cases.py — Case (Report) CRUD using SQLAlchemy + raw SQL.

All writes use idempotent INSERT … ON CONFLICT DO NOTHING so Background Sync
retries never create duplicate rows (ref.md §15).

report_to_dict() converts ORM rows → the exact JSON shape the existing API
returns — no frontend changes required.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Optional

from geoalchemy2 import shape as ga_shape
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.report import Report
from app.models.risk import RiskAssessment
from app.services.risk_engine import calculate_risk

LIFECYCLE = [
    "REPORTED", "RISK_ANALYZED", "UNDER_INVESTIGATION",
    "LAB_TESTING", "LAB_CONFIRMED", "ALERT_SENT", "CONTAINMENT",
]


# ─── Shape converter ──────────────────────────────────────────────────────────

def _geom_to_lat_lng(geom) -> tuple[Optional[float], Optional[float]]:
    """Extract (lat, lng) from a GeoAlchemy2 WKBElement. Returns (None, None) on failure."""
    if geom is None:
        return None, None
    try:
        pt = ga_shape.to_shape(geom)
        return pt.y, pt.x   # PostGIS stores as (lng, lat) = (x, y)
    except Exception:
        return None, None


# ─── Response serialiser ──────────────────────────────────────────────────────

def report_to_dict(r: Report) -> dict:
    """
    Convert ORM Report row → the exact dict shape all existing API routes return.
    No frontend response-shape changes required.
    """
    lat, lng = _geom_to_lat_lng(r.geom)
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
        "lat":              lat,
        "lng":              lng,
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
        q = q.filter(Report.species.ilike(species))
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
    Idempotent report insert (ON CONFLICT (idempotency_key) DO NOTHING).

    Returns (report_dict, is_new):
      is_new=False when the idempotency_key already existed (replay detected).
    """
    idem_key = data.get("idempotency_key") or str(uuid.uuid4())
    new_id   = str(uuid.uuid4())
    now      = datetime.now(timezone.utc)

    lat = data.get("lat")
    lng = data.get("lng")

    sql = text("""
        INSERT INTO reports (
            id, idempotency_key, tag_id,
            species, breed, age_years,
            village, taluk, district, state,
            geom, syndrome, symptoms, mortality, affected_animals,
            reported_by, assigned_vet, status,
            risk_factors, notes, tier1_triage,
            created_at_client, received_at, updated_at
        ) VALUES (
            :id, :idem_key, :tag_id,
            :species, :breed, :age_years,
            :village, :taluk, :district, :state,
            ST_SetSRID(ST_MakePoint(:lng, :lat), 4326),
            :syndrome, :symptoms::jsonb, :mortality, :affected_animals,
            :reported_by, :assigned_vet, :status,
            :risk_factors::jsonb, :notes, :tier1_triage::jsonb,
            :created_at_client, :received_at, :updated_at
        )
        ON CONFLICT (idempotency_key) DO NOTHING
    """)

    result = db.execute(sql, {
        "id":              new_id,
        "idem_key":        idem_key,
        "tag_id":          data.get("tag_id"),
        "species":         data.get("species"),
        "breed":           data.get("breed"),
        "age_years":       data.get("age_years"),
        "village":         data.get("village"),
        "taluk":           data.get("taluk"),
        "district":        data.get("district"),
        "state":           data.get("state", "Maharashtra"),
        "lng":             lng,
        "lat":             lat,
        "syndrome":        data.get("syndrome"),
        "symptoms":        json.dumps(data.get("symptoms", [])),
        "mortality":       data.get("mortality", 0),
        "affected_animals": data.get("affected_animals", 1),
        "reported_by":     data.get("reported_by"),
        "assigned_vet":    data.get("assigned_vet"),
        "status":          data.get("status", "REPORTED"),
        "risk_factors":    json.dumps(data.get("risk_factors", {})),
        "notes":           data.get("notes", ""),
        "tier1_triage":    json.dumps(tier1_result or {}),
        "created_at_client": now,
        "received_at":     now,
        "updated_at":      now,
    })
    db.commit()

    is_new = result.rowcount == 1   # 0 = conflict (replay), 1 = inserted

    # Fetch the row (might be the existing one if key was duplicated)
    r = db.query(Report).filter(Report.idempotency_key == idem_key).first()

    # Persist risk assessment
    if r and data.get("risk_factors") and is_new:
        rf = data["risk_factors"]
        risk = calculate_risk(**rf)
        db.execute(text("""
            INSERT INTO risk_assessments (id, report_id, crs, tier, factors, computed_at)
            VALUES (:id, :report_id::uuid, :crs, :tier, :factors::jsonb, now())
            ON CONFLICT (report_id) DO NOTHING
        """), {
            "id":        str(uuid.uuid4()),
            "report_id": str(r.id),
            "crs":       risk["score"],
            "tier":      risk["level"],
            "factors":   json.dumps(rf),
        })
        db.commit()

    return report_to_dict(r), is_new


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
