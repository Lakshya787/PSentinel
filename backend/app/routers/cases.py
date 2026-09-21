"""
app/routers/cases.py — Case lifecycle, query, and containment ring endpoints.
"""
from __future__ import annotations

import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.middleware.auth import require_role
from app.models.user import User
from app.repositories import cases as case_repo
from app.schemas.case import ActionIn

router = APIRouter(prefix="/cases", tags=["Cases"])


@router.get("")
@router.get("/")
def list_cases(
    status:  Optional[str] = Query(None, description="Filter by lifecycle status"),
    species: Optional[str] = Query(None),
    limit:   int           = Query(100, le=200),
    db:      Session       = Depends(get_db),
):
    """Return all cases sorted by risk score descending."""
    cases = case_repo.list_reports(db, status=status, species=species, limit=limit)
    return {"total": len(cases), "cases": cases}


@router.get("/{case_id}")
def get_case(case_id: str, db: Session = Depends(get_db)):
    """Return full details of a single case including computed risk."""
    case = case_repo.get_report(db, case_id)
    if not case:
        raise HTTPException(404, f"Case '{case_id}' not found.")
    return case


@router.get("/{case_id}/zones")
def get_case_zones(case_id: str, db: Session = Depends(get_db)):
    """Return GeoJSON containment rings (3 km + 10 km) for a case."""
    case = case_repo.get_report_orm(db, case_id)
    if not case:
        raise HTTPException(404, f"Case '{case_id}' not found.")

    lat, lng = case_repo._geom_to_lat_lng(case.geom)
    if lat is None:
        raise HTTPException(422, "Case has no geolocation.")

    zones = db.execute(
        text("""
            SELECT ring_km, ST_AsGeoJSON(geom)::text AS geojson, created_at
            FROM containment_zones
            WHERE report_id = :rid::uuid
            ORDER BY ring_km
        """),
        {"rid": str(case.id)},
    ).fetchall()

    return {
        "case_id": case_id,
        "zones": [
            {
                "ring_km":    z.ring_km,
                "geojson":    json.loads(z.geojson) if z.geojson else None,
                "created_at": z.created_at.isoformat() if z.created_at else None,
            }
            for z in zones
        ],
    }


@router.post("/{case_id}/action")
def case_action(
    case_id: str,
    body: ActionIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_role("VET", "DVO")),
):
    """Advance lifecycle or assign a vet to a case."""
    if body.action == "ADVANCE_STATUS":
        result = case_repo.advance_status(db, case_id, note=body.notes or "")
        if result is None:
            raise HTTPException(404, f"Case '{case_id}' not found.")
        if result == "FINAL":
            raise HTTPException(400, "Case is already at final status.")
        return {"case_id": case_id, "new_status": result["status"], "case": result}

    elif body.action == "ASSIGN_VET":
        if not body.vet_id:
            raise HTTPException(400, "vet_id is required for ASSIGN_VET.")
        result = case_repo.assign_vet(db, case_id, body.vet_id)
        if result is None:
            raise HTTPException(404, f"Case '{case_id}' not found.")
        return {"case_id": case_id, "new_status": result["status"], "case": result}

    else:
        raise HTTPException(400, f"Unknown action '{body.action}'.")
