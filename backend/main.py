# ─── Pashu Sentinel — FastAPI Backend ────────────────────────────────────────
# Run: uvicorn main:app --reload --port 8000
#
# Endpoints:
#   GET  /                          Health check
#   GET  /syndromes                 List all 7 syndromic case definitions (ref.md §10.2)
#   GET  /cases                     List all cases (with optional filters)
#   GET  /cases/{case_id}           Get single case details
#   POST /reports                   Submit a field report (Tier 1 auto-scored)
#   POST /cases/{case_id}/action    Advance case status
#   GET  /risk/{case_id}            Get WLC composite risk score
#   GET  /analyze/{case_id}         Run full 3-tier ML pipeline (ref.md §10)
#   GET  /clusters                  Global ST-DBSCAN cluster view (ref.md §11)

from __future__ import annotations

import logging
import uuid
from contextlib import asynccontextmanager
from copy import deepcopy
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ml_engine import (
    IsolationForestTriage,
    EWMAFarrington,
    classify_syndrome,
    cluster_summary,
    run_three_tier_pipeline,
    st_dbscan,
    SYNDROME_DEFINITIONS,
)
from risk_engine import calculate_risk
from seed_data import SEEDED_CASES

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pashu.api")

# ─── Global ML model instances ────────────────────────────────────────────────
IF_MODEL:   IsolationForestTriage | None = None
EWMA_MODEL: EWMAFarrington        | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application startup: train Isolation Forest + build EWMA series
    from seeded cases so /analyze is ready immediately on first request.
    """
    global IF_MODEL, EWMA_MODEL

    logger.info("=== Pashu Sentinel ML Engine — Startup Training ===")

    # Enrich seeded cases with computed risk before training
    enriched_seed = []
    for c in SEEDED_CASES:
        ec = deepcopy(c)
        rf = ec.get("risk_factors", {})
        if rf:
            ec["risk"] = calculate_risk(**rf)
        # Ensure syndrome is classified from symptoms
        if not ec.get("syndrome"):
            ec["syndrome"] = classify_syndrome(ec.get("symptoms", []))
        enriched_seed.append(ec)

    # Tier 1 — Isolation Forest
    IF_MODEL = IsolationForestTriage(contamination=0.15).fit(enriched_seed)

    # Tier 2 — EWMA/Farrington time series
    EWMA_MODEL = EWMAFarrington().build_series(enriched_seed)

    logger.info("=== ML Engine ready — all endpoints active ===")
    yield
    logger.info("Pashu Sentinel shutting down.")


# ─── App Setup ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Pashu Sentinel API",
    description=(
        "Smart livestock disease early-warning platform.\n\n"
        "**Intelligence Engine** (ref.md §10):\n"
        "- Tier 1: Isolation Forest case-level triage\n"
        "- Tier 2: EWMA + Noufaily-Farrington temporal aberration\n"
        "- Tier 3: ST-DBSCAN spatio-temporal clustering"
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── In-memory store (seeded at startup) ─────────────────────────────────────
db: dict[str, dict] = {}

for c in SEEDED_CASES:
    ec = deepcopy(c)
    rf = ec.get("risk_factors", {})
    if rf:
        ec["risk"] = calculate_risk(**rf)
    if not ec.get("syndrome"):
        ec["syndrome"] = classify_syndrome(ec.get("symptoms", []))
    db[ec["id"]] = ec

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
    clinical:      float
    vaccination:   float
    environmental: float
    spatial:       float


class FieldReportIn(BaseModel):
    species:         str
    breed:           Optional[str]  = None
    age_years:       Optional[float] = None
    village:         str
    taluk:           str
    district:        str
    state:           str            = "Maharashtra"
    lat:             float
    lng:             float
    symptoms:        List[str]
    mortality:       int            = 0
    affected_animals: int           = 1
    reported_by:     str
    notes:           Optional[str]  = ""
    risk_factors:    Optional[RiskFactors] = None


class ActionIn(BaseModel):
    action:  str
    vet_id:  Optional[str] = None
    notes:   Optional[str] = ""


# ─── Helper ───────────────────────────────────────────────────────────────────

def _all_cases_with_risk() -> list[dict]:
    cases = list(db.values())
    for c in cases:
        rf = c.get("risk_factors", {})
        if rf and "risk" not in c:
            c["risk"] = calculate_risk(**rf)
    return cases


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
def health():
    return {
        "status":  "ok",
        "service": "pashu-sentinel-api",
        "version": "1.0.0",
        "ml_engine": {
            "isolation_forest": IF_MODEL is not None and IF_MODEL._trained,
            "ewma_farrington":  EWMA_MODEL is not None,
        },
    }


@app.get("/syndromes", tags=["Intelligence"])
def get_syndromes():
    """
    Return all 7 syndromic case definitions (ref.md §10.2).
    Used by the frontend to populate the syndromic triage checklist.
    """
    return {
        "total":     len(SYNDROME_DEFINITIONS),
        "syndromes": [
            {
                "key":      key,
                "label":    defn["label"],
                "triggers": sorted(defn["triggers"]),
                "diseases": defn["diseases"],
            }
            for key, defn in SYNDROME_DEFINITIONS.items()
        ],
    }


@app.get("/cases", tags=["Cases"])
def list_cases(
    status:  Optional[str] = Query(None, description="Filter by lifecycle status"),
    species: Optional[str] = Query(None),
    limit:   int           = Query(100, le=200),
):
    """Return all cases sorted by risk score descending."""
    cases = _all_cases_with_risk()
    if status:
        cases = [c for c in cases if c["status"] == status.upper()]
    if species:
        cases = [c for c in cases if c["species"].lower() == species.lower()]
    cases.sort(key=lambda c: c.get("risk", {}).get("score", 0), reverse=True)
    return {"total": len(cases), "cases": cases[:limit]}


@app.get("/cases/{case_id}", tags=["Cases"])
def get_case(case_id: str):
    """Return full details of a single case including computed risk."""
    case = db.get(case_id)
    if not case:
        raise HTTPException(404, f"Case '{case_id}' not found.")
    result = deepcopy(case)
    rf = result.get("risk_factors", {})
    if rf:
        result["risk"] = calculate_risk(**rf)
    return result


@app.post("/reports", status_code=201, tags=["Field Reports"])
def submit_report(report: FieldReportIn):
    """
    Accept a field report from a field worker.
    Automatically:
      - Classifies syndromic category (ref.md §10.2)
      - Runs Tier 1 Isolation Forest triage (ref.md §10.1)
      - Computes WLC composite risk score (ref.md §13)
    """
    tag_prefix = {"Cattle": "COW", "Buffalo": "BUF", "Goat": "GOAT", "Sheep": "SHP"}.get(
        report.species, "ANM"
    )
    new_id = f"{tag_prefix}-{uuid.uuid4().hex[:4].upper()}"
    now    = datetime.now(timezone.utc).isoformat()

    risk_factors = (
        report.risk_factors.model_dump() if report.risk_factors
        else {"clinical": 50, "vaccination": 50, "environmental": 50, "spatial": 50}
    )

    syndrome = classify_syndrome(report.symptoms)

    case: dict = {
        "id":               new_id,
        "tag_id":           new_id,
        "species":          report.species,
        "breed":            report.breed,
        "age_years":        report.age_years,
        "village":          report.village,
        "taluk":            report.taluk,
        "district":         report.district,
        "state":            report.state,
        "lat":              report.lat,
        "lng":              report.lng,
        "symptoms":         report.symptoms,
        "mortality":        report.mortality,
        "affected_animals": report.affected_animals,
        "reported_by":      report.reported_by,
        "assigned_vet":     None,
        "status":           "REPORTED",
        "syndrome":         syndrome,
        "risk_factors":     risk_factors,
        "reported_at":      now,
        "updated_at":       now,
        "notes":            report.notes,
        "risk":             calculate_risk(**risk_factors),
    }

    # ── Tier 1 Auto-Triage ────────────────────────────────────────────────────
    tier1_result = {"anomaly_score": 0.5, "is_anomalous": False, "decision": "UNTRAINED"}
    if IF_MODEL and IF_MODEL._trained:
        tier1_result = IF_MODEL.score(case)
        case["tier1_triage"] = tier1_result
        # Auto-elevate status if anomalous
        if tier1_result["is_anomalous"]:
            case["status"] = "RISK_ANALYZED"
            logger.info(
                f"[Tier 1] ANOMALY flagged for {new_id} "
                f"(score={tier1_result['anomaly_score']:.4f})"
            )

    db[new_id] = case
    return {
        "case_id":    new_id,
        "case":       case,
        "tier1_triage": tier1_result,
        "syndrome_classified": syndrome,
    }


@app.post("/cases/{case_id}/action", tags=["Cases"])
def case_action(case_id: str, body: ActionIn):
    """Advance lifecycle or assign a vet to a case."""
    case = db.get(case_id)
    if not case:
        raise HTTPException(404, f"Case '{case_id}' not found.")

    if body.action == "ADVANCE_STATUS":
        idx = LIFECYCLE.index(case["status"]) if case["status"] in LIFECYCLE else -1
        if idx == -1 or idx >= len(LIFECYCLE) - 1:
            raise HTTPException(400, "Case is already at final status.")
        case["status"]     = LIFECYCLE[idx + 1]
        case["updated_at"] = datetime.now(timezone.utc).isoformat()
        if body.notes:
            case["notes"] = (case.get("notes", "") + f"\n[{case['status']}] {body.notes}").strip()

    elif body.action == "ASSIGN_VET":
        if not body.vet_id:
            raise HTTPException(400, "vet_id is required for ASSIGN_VET.")
        case["assigned_vet"] = body.vet_id
        case["updated_at"]   = datetime.now(timezone.utc).isoformat()

    else:
        raise HTTPException(400, f"Unknown action '{body.action}'.")

    return {"case_id": case_id, "new_status": case["status"], "case": case}


@app.get("/risk/{case_id}", tags=["Risk"])
def get_risk(case_id: str):
    """Return WLC composite risk score for a case (ref.md §13)."""
    case = db.get(case_id)
    if not case:
        raise HTTPException(404, f"Case '{case_id}' not found.")
    rf = case.get("risk_factors", {})
    if not rf:
        raise HTTPException(422, "No risk factors recorded for this case.")
    return {"case_id": case_id, "risk": calculate_risk(**rf)}


@app.get("/analyze/{case_id}", tags=["Intelligence"])
def analyze_case(case_id: str):
    """
    Run the full Three-Tier ML Intelligence Pipeline on a case (ref.md §10).

    Returns:
    - **Tier 1** — Isolation Forest anomaly score & decision
    - **Tier 2** — EWMA + Farrington temporal aberration detection
    - **Tier 3** — ST-DBSCAN spatio-temporal cluster membership
    - **intelligence_summary** — triggers fired, ML confidence, recommendation
    """
    case = db.get(case_id)
    if not case:
        raise HTTPException(404, f"Case '{case_id}' not found.")

    if IF_MODEL is None or EWMA_MODEL is None:
        raise HTTPException(503, "ML engine not yet initialised. Retry in a moment.")

    all_cases = _all_cases_with_risk()
    return run_three_tier_pipeline(case, IF_MODEL, EWMA_MODEL, all_cases)


@app.get("/clusters", tags=["Intelligence"])
def get_clusters():
    """
    Run ST-DBSCAN on all cases and return global cluster summary (ref.md §11).

    Identifies contiguous outbreak boundaries using:
      eps_spatial=10km, eps_temporal=7days, minPts=2
    """
    all_cases = _all_cases_with_risk()
    geo_cases = [c for c in all_cases if c.get("lat") is not None and c.get("lng") is not None]
    clustered = st_dbscan(geo_cases)
    summaries = cluster_summary(clustered)

    noise_count = sum(1 for c in clustered if c.get("cluster_id") == -1)

    return {
        "total_cases":    len(geo_cases),
        "clustered":      len(geo_cases) - noise_count,
        "isolated_noise": noise_count,
        "cluster_count":  len(summaries),
        "clusters":       summaries,
        "parameters": {
            "algorithm":         "ST-DBSCAN",
            "eps_spatial_km":    10.0,
            "eps_temporal_days": 7,
            "min_pts":           2,
        },
    }

