# ─── Pashu Sentinel — FastAPI Backend ────────────────────────────────────────
# Run: uvicorn main:app --reload --port 8000
#
# Endpoints:
#   GET  /                      Health check
#   GET  /cases                 List all cases (with optional status filter)
#   GET  /cases/{case_id}       Get single case details
#   POST /reports               Submit a field report (creates new case)
#   POST /cases/{case_id}/action  Advance case status
#   GET  /risk/{case_id}        Get computed risk for a case

from __future__ import annotations

import uuid
from copy import deepcopy
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from risk_engine import calculate_risk
from seed_data import SEEDED_CASES

# ─── App Setup ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Pashu Sentinel API",
    description="Smart livestock disease early-warning platform — demo MVP backend.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── In-memory store (seeded at startup) ─────────────────────────────────────
# Keyed by case_id. Deep-copied so mutations don't affect original seed.
db: dict[str, dict] = {c["id"]: deepcopy(c) for c in SEEDED_CASES}

LIFECYCLE = [
    "REPORTED",
    "RISK_ANALYZED",
    "UNDER_INVESTIGATION",
    "LAB_TESTING",
    "LAB_CONFIRMED",
    "ALERT_SENT",
    "CONTAINMENT",
]


# ─── Pydantic Schemas ─────────────────────────────────────────────────────────

class RiskFactors(BaseModel):
    clinical: float
    vaccination: float
    environmental: float
    spatial: float


class FieldReportIn(BaseModel):
    species: str
    breed: Optional[str] = None
    age_years: Optional[float] = None
    village: str
    taluk: str
    district: str
    state: str = "Maharashtra"
    lat: float
    lng: float
    symptoms: List[str]
    mortality: int = 0
    reported_by: str
    notes: Optional[str] = ""
    risk_factors: Optional[RiskFactors] = None


class ActionIn(BaseModel):
    action: str  # e.g. "ADVANCE_STATUS", "ASSIGN_VET"
    vet_id: Optional[str] = None
    notes: Optional[str] = ""


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
def health():
    return {"status": "ok", "service": "pashu-sentinel-api", "version": "0.1.0"}


@app.get("/cases", tags=["Cases"])
def list_cases(
    status: Optional[str] = Query(None, description="Filter by status"),
    species: Optional[str] = Query(None),
    limit: int = Query(100, le=200),
):
    """Return all seeded cases, with optional filters."""
    cases = list(db.values())
    if status:
        cases = [c for c in cases if c["status"] == status.upper()]
    if species:
        cases = [c for c in cases if c["species"].lower() == species.lower()]
    # Sort by reported_at descending
    cases.sort(key=lambda c: c["reported_at"], reverse=True)
    # Attach computed risk to each case
    for c in cases:
        rf = c.get("risk_factors", {})
        if rf:
            c["risk"] = calculate_risk(**rf)
    return {"total": len(cases), "cases": cases[:limit]}


@app.get("/cases/{case_id}", tags=["Cases"])
def get_case(case_id: str):
    """Return full details of a single case, including computed risk."""
    case = db.get(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found.")
    result = deepcopy(case)
    rf = result.get("risk_factors", {})
    if rf:
        result["risk"] = calculate_risk(**rf)
    return result


@app.post("/reports", status_code=201, tags=["Field Reports"])
def submit_report(report: FieldReportIn):
    """
    Accept a field report from a field worker.
    Auto-generates a case ID and computes risk if risk_factors provided.
    """
    tag_prefix = {"Cattle": "COW", "Buffalo": "BUF", "Goat": "GOAT", "Sheep": "SHP"}.get(
        report.species, "ANM"
    )
    new_id = f"{tag_prefix}-{uuid.uuid4().hex[:4].upper()}"
    now = datetime.now(timezone.utc).isoformat()

    risk_factors = (
        report.risk_factors.model_dump() if report.risk_factors else
        {"clinical": 50, "vaccination": 50, "environmental": 50, "spatial": 50}
    )

    case = {
        "id":          new_id,
        "tag_id":      new_id,
        "species":     report.species,
        "breed":       report.breed,
        "age_years":   report.age_years,
        "village":     report.village,
        "taluk":       report.taluk,
        "district":    report.district,
        "state":       report.state,
        "lat":         report.lat,
        "lng":         report.lng,
        "symptoms":    report.symptoms,
        "mortality":   report.mortality,
        "reported_by": report.reported_by,
        "assigned_vet": None,
        "status":       "REPORTED",
        "risk_factors": risk_factors,
        "reported_at":  now,
        "updated_at":   now,
        "notes":        report.notes,
        "risk":         calculate_risk(**risk_factors),
    }

    db[new_id] = case
    return {"case_id": new_id, "case": case}


@app.post("/cases/{case_id}/action", tags=["Cases"])
def case_action(case_id: str, body: ActionIn):
    """
    Perform an action on a case.
    Supported actions: ADVANCE_STATUS, ASSIGN_VET.
    """
    case = db.get(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found.")

    if body.action == "ADVANCE_STATUS":
        current_idx = LIFECYCLE.index(case["status"]) if case["status"] in LIFECYCLE else -1
        if current_idx == -1 or current_idx >= len(LIFECYCLE) - 1:
            raise HTTPException(status_code=400, detail="Case is already at final status.")
        case["status"] = LIFECYCLE[current_idx + 1]
        case["updated_at"] = datetime.now(timezone.utc).isoformat()
        if body.notes:
            case["notes"] = (case.get("notes", "") + f"\n[{case['status']}] {body.notes}").strip()

    elif body.action == "ASSIGN_VET":
        if not body.vet_id:
            raise HTTPException(status_code=400, detail="vet_id is required for ASSIGN_VET.")
        case["assigned_vet"] = body.vet_id
        case["updated_at"] = datetime.now(timezone.utc).isoformat()

    else:
        raise HTTPException(status_code=400, detail=f"Unknown action '{body.action}'.")

    return {"case_id": case_id, "new_status": case["status"], "case": case}


@app.get("/risk/{case_id}", tags=["Risk"])
def get_risk(case_id: str):
    """Return computed risk score for a case."""
    case = db.get(case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case '{case_id}' not found.")
    rf = case.get("risk_factors", {})
    if not rf:
        raise HTTPException(status_code=422, detail="No risk factors recorded for this case.")
    return {"case_id": case_id, "risk": calculate_risk(**rf)}
