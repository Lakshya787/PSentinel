# ─── Pashu Sentinel — FastAPI Backend ────────────────────────────────────────
# Run: uvicorn main:app --reload --port 8000
#
# All data now reads/writes PostgreSQL + PostGIS via the repository layer.
# Response shapes are identical to the old in-memory version so the frontend
# needs no changes.
#
# Endpoints:
#   GET  /                          Health check
#   GET  /health/db                 DB connectivity + PostGIS check
#   GET  /syndromes                 List 7 syndromic case definitions
#   GET  /cases                     List all cases (filters: status, species, limit)
#   GET  /cases/{case_id}           Get single case details
#   GET  /cases/{case_id}/zones     GeoJSON containment rings for a case
#   POST /reports                   Submit a field report (Tier 1 auto-scored)
#   POST /cases/{case_id}/action    Advance case status / assign vet
#   GET  /risk/{case_id}            WLC composite risk score
#   GET  /analyze/{case_id}         Full 3-tier ML pipeline
#   GET  /clusters                  ST_ClusterDBSCAN cluster view (real PostGIS)
#   GET  /neighbours/{case_id}      ST_DWithin neighbouring reports

from __future__ import annotations

import json
import logging
import uuid
from contextlib import asynccontextmanager
from copy import deepcopy
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from auth import get_current_user, require_role
from db import get_db
from models import User
from ml_engine import (
    IsolationForestTriage,
    EWMAFarrington,
    classify_syndrome,
    cluster_summary,
    run_three_tier_pipeline,
    st_dbscan,
    SYNDROME_DEFINITIONS,
)
from repositories import cases as case_repo
from repositories import spatial as spatial_repo
from risk_engine import calculate_risk
from routers.auth_router import router as auth_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pashu.api")

# ─── Global ML model instances ────────────────────────────────────────────────
IF_MODEL:   IsolationForestTriage | None = None
EWMA_MODEL: EWMAFarrington        | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup: train ML models from DB seed data.
    Models are retrained from live DB rows so they stay current.
    """
    global IF_MODEL, EWMA_MODEL

    logger.info("=== Pashu Sentinel ML Engine — Startup Training ===")
    try:
        db = next(get_db())
        seed_cases = case_repo.list_reports(db, limit=500)
        db.close()
    except Exception as exc:
        logger.warning(f"DB unavailable at startup ({exc}); ML models will train on first request.")
        seed_cases = []

    enriched = []
    for c in seed_cases:
        ec = deepcopy(c)
        rf = ec.get("risk_factors", {})
        if rf and len(rf) == 4:
            ec["risk"] = calculate_risk(**rf)
        if not ec.get("syndrome"):
            ec["syndrome"] = classify_syndrome(ec.get("symptoms", []))
        enriched.append(ec)

    IF_MODEL   = IsolationForestTriage(contamination=0.15).fit(enriched)
    EWMA_MODEL = EWMAFarrington().build_series(enriched)
    logger.info(f"=== ML Engine ready — trained on {len(enriched)} cases ===")
    yield
    logger.info("Pashu Sentinel shutting down.")


# ─── App Setup ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Pashu Sentinel API",
    description=(
        "Smart livestock disease early-warning platform.\n\n"
        "**Database**: PostgreSQL + PostGIS (real spatial queries).\n"
        "**Intelligence Engine** (ref.md §10):\n"
        "- Tier 1: Isolation Forest case-level triage\n"
        "- Tier 2: EWMA + Noufaily-Farrington temporal aberration\n"
        "- Tier 3: ST_ClusterDBSCAN spatio-temporal clustering (PostGIS)"
    ),
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(auth_router)


# ─── Pydantic Schemas ─────────────────────────────────────────────────────────

class RiskFactors(BaseModel):
    clinical:      float
    vaccination:   float
    environmental: float
    spatial:       float


class FieldReportIn(BaseModel):
    tag_id:           Optional[str]   = None
    idempotency_key:  Optional[str]   = None
    species:          str
    breed:            Optional[str]   = None
    age_years:        Optional[float] = None
    village:          str
    taluk:            str
    district:         str
    state:            str             = "Maharashtra"
    lat:              float
    lng:              float
    symptoms:         List[str]
    mortality:        int             = 0
    affected_animals: int             = 1
    reported_by:      str
    notes:            Optional[str]   = ""
    risk_factors:     Optional[RiskFactors] = None


class ActionIn(BaseModel):
    action:  str
    vet_id:  Optional[str] = None
    notes:   Optional[str] = ""


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
def health():
    return {
        "status":  "ok",
        "service": "pashu-sentinel-api",
        "version": "2.0.0",
        "database": "postgresql+postgis",
        "ml_engine": {
            "isolation_forest": IF_MODEL is not None and IF_MODEL._trained,
            "ewma_farrington":  EWMA_MODEL is not None,
        },
    }


@app.get("/health/db", tags=["Health"])
def health_db(db: Session = Depends(get_db)):
    """SELECT 1 liveness check + PostGIS extension presence."""
    try:
        db.execute(text("SELECT 1"))
        postgis = db.execute(
            text("SELECT extversion FROM pg_extension WHERE extname = 'postgis'")
        ).scalar()
        tables = db.execute(
            text("SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
        ).scalar()
        return {
            "status":         "ok",
            "postgres":       True,
            "postgis":        postgis or "not_installed",
            "public_tables":  int(tables or 0),
        }
    except Exception as exc:
        raise HTTPException(503, f"DB unreachable: {exc}")


@app.get("/syndromes", tags=["Intelligence"])
def get_syndromes():
    """Return all 7 syndromic case definitions (ref.md §10.2)."""
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
    db:      Session       = Depends(get_db),
):
    """Return all cases sorted by risk score descending."""
    cases = case_repo.list_reports(db, status=status, species=species, limit=limit)
    return {"total": len(cases), "cases": cases}


@app.get("/cases/{case_id}", tags=["Cases"])
def get_case(case_id: str, db: Session = Depends(get_db)):
    """Return full details of a single case including computed risk."""
    case = case_repo.get_report(db, case_id)
    if not case:
        raise HTTPException(404, f"Case '{case_id}' not found.")
    return case


@app.get("/cases/{case_id}/zones", tags=["Cases"])
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


@app.post("/reports", status_code=201, tags=["Field Reports"])
def submit_report(
    report: FieldReportIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Accept a field report from a field worker.
    Automatically:
      - Classifies syndromic category (ref.md §10.2)
      - Runs Tier 1 Isolation Forest triage (ref.md §10.1)
      - Computes WLC composite risk score (ref.md §13)
      - Runs ST_DWithin spatial lag query and feeds result into risk score
      - Creates 3 km + 10 km containment rings (ST_Buffer)
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
    # Vaccination risk factor: lower coverage = higher risk (0→100 scale)
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
    if IF_MODEL and IF_MODEL._trained:
        tier1_result = IF_MODEL.score(case_preview)

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


@app.post("/cases/{case_id}/action", tags=["Cases"])
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


@app.get("/risk/{case_id}", tags=["Risk"])
def get_risk(case_id: str, db: Session = Depends(get_db)):
    """Return WLC composite risk score for a case (ref.md §13)."""
    case = case_repo.get_report(db, case_id)
    if not case:
        raise HTTPException(404, f"Case '{case_id}' not found.")
    rf = case.get("risk_factors", {})
    if not rf or len(rf) < 4:
        raise HTTPException(422, "No risk factors recorded for this case.")
    return {"case_id": case_id, "risk": calculate_risk(**rf)}


@app.get("/neighbors/{case_id}", tags=["Spatial"])
@app.get("/neighbours/{case_id}", tags=["Spatial"])
def get_neighbours(
    case_id:  str,
    radius_m: float = Query(15000, description="Search radius in metres"),
    days:     int   = Query(4,     description="Look-back window in days"),
    db:       Session = Depends(get_db),
):
    """ST_DWithin neighbouring reports with same syndrome (real PostGIS)."""
    case = case_repo.get_report_orm(db, case_id)
    if not case:
        raise HTTPException(404, f"Case '{case_id}' not found.")
    lat, lng = case_repo._geom_to_lat_lng(case.geom)
    if lat is None:
        raise HTTPException(422, "Case has no geolocation.")
    neighbours = spatial_repo.neighbouring_reports(
        db, lat=lat, lon=lng,
        syndrome=case.syndrome or "",
        radius_m=radius_m, days=days,
        exclude_id=str(case.id),
    )
    return {
        "case_id":    case_id,
        "syndrome":   case.syndrome,
        "radius_m":   radius_m,
        "days":       days,
        "count":      len(neighbours),
        "neighbours": neighbours,
    }


@app.get("/analyze/{case_id}", tags=["Intelligence"])
def analyze_case(case_id: str, db: Session = Depends(get_db)):
    """
    Run the full Three-Tier ML Intelligence Pipeline on a case (ref.md §10).
    """
    case = case_repo.get_report(db, case_id)
    if not case:
        raise HTTPException(404, f"Case '{case_id}' not found.")
    if IF_MODEL is None or EWMA_MODEL is None:
        raise HTTPException(503, "ML engine not yet initialised. Retry in a moment.")
    all_cases = case_repo.list_reports(db, limit=500)
    return run_three_tier_pipeline(case, IF_MODEL, EWMA_MODEL, all_cases)


@app.get("/clusters", tags=["Intelligence"])
def get_clusters(db: Session = Depends(get_db)):
    """
    ST_ClusterDBSCAN cluster view — real PostGIS window function.
    eps=5 km (EPSG:32643 UTM 43N), minpoints=3, window=14 days.
    """
    return spatial_repo.postgis_cluster_dbscan(db)


# ─── Internal helpers ─────────────────────────────────────────────────────────

def _clinical_score(symptoms: list[str], mortality: int) -> float:
    """Rough clinical risk sub-score from symptom count + mortality."""
    base = min(100.0, 30.0 + len(symptoms) * 10.0)
    if mortality > 0:
        base = min(100.0, base + 20.0)
    return round(base, 1)
