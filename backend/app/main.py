"""
app/main.py — Pashu Sentinel FastAPI application factory & entry point.

SQLite edition:
  - Tables created automatically at startup via Base.metadata.create_all()
  - Demo villages seeded on first run (Pune / Maharashtra region)
  - ML models trained from DB on startup
"""
from __future__ import annotations

import logging
import uuid
from contextlib import asynccontextmanager
from copy import deepcopy
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.session import Base, engine, get_db
from app.repositories import cases as case_repo
from app.routers.auth import router as auth_router
from app.routers.cases import router as cases_router
from app.routers.health import router as health_router
from app.routers.reports import router as reports_router
from app.routers.risk import router as risk_router
from app.routers.spatial import router as spatial_router
from app.services.ml_engine import (
    EWMAFarrington,
    IsolationForestTriage,
    classify_syndrome,
    set_models,
)
from app.services.risk_engine import calculate_risk

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pashu.api")

# ─── Demo village seed data (Pune district, Maharashtra) ─────────────────────
_DEMO_VILLAGES = [
    {"name": "Uruli Kanchan", "taluk": "Haveli",   "district": "Pune",    "state": "Maharashtra", "lat": 18.4835, "lng": 74.0741, "livestock_count": 1200, "fmd_vax_coverage": 0.72},
    {"name": "Jejuri",        "taluk": "Purandar",  "district": "Pune",    "state": "Maharashtra", "lat": 18.2732, "lng": 74.1566, "livestock_count": 980,  "fmd_vax_coverage": 0.65},
    {"name": "Baramati",      "taluk": "Baramati",  "district": "Pune",    "state": "Maharashtra", "lat": 18.1518, "lng": 74.5816, "livestock_count": 1450, "fmd_vax_coverage": 0.80},
    {"name": "Saswad",        "taluk": "Purandar",  "district": "Pune",    "state": "Maharashtra", "lat": 18.3428, "lng": 74.0305, "livestock_count": 870,  "fmd_vax_coverage": 0.60},
    {"name": "Khed",          "taluk": "Khed",      "district": "Pune",    "state": "Maharashtra", "lat": 18.8374, "lng": 73.9941, "livestock_count": 1100, "fmd_vax_coverage": 0.75},
    {"name": "Junnar",        "taluk": "Junnar",    "district": "Pune",    "state": "Maharashtra", "lat": 19.2056, "lng": 73.8800, "livestock_count": 1350, "fmd_vax_coverage": 0.68},
    {"name": "Shirur",        "taluk": "Shirur",    "district": "Pune",    "state": "Maharashtra", "lat": 18.8266, "lng": 74.3688, "livestock_count": 920,  "fmd_vax_coverage": 0.70},
    {"name": "Indapur",       "taluk": "Indapur",   "district": "Pune",    "state": "Maharashtra", "lat": 18.1128, "lng": 75.0205, "livestock_count": 1600, "fmd_vax_coverage": 0.55},
    {"name": "Bhor",          "taluk": "Bhor",      "district": "Pune",    "state": "Maharashtra", "lat": 18.1533, "lng": 73.8460, "livestock_count": 760,  "fmd_vax_coverage": 0.63},
    {"name": "Ambegaon",      "taluk": "Ambegaon",  "district": "Pune",    "state": "Maharashtra", "lat": 19.1233, "lng": 73.7500, "livestock_count": 1050, "fmd_vax_coverage": 0.71},
    {"name": "Osmanabad",     "taluk": "Osmanabad", "district": "Osmanabad","state": "Maharashtra","lat": 18.1808, "lng": 76.0395, "livestock_count": 2100, "fmd_vax_coverage": 0.50},
    {"name": "Latur",         "taluk": "Latur",     "district": "Latur",   "state": "Maharashtra", "lat": 18.4088, "lng": 76.5604, "livestock_count": 1890, "fmd_vax_coverage": 0.48},
]


def _seed_villages(db):
    """Insert demo villages if the villages table is empty."""
    from app.models.village import Village
    if db.query(Village).count() > 0:
        return
    for v in _DEMO_VILLAGES:
        db.add(Village(
            id               = str(uuid.uuid4()),
            name             = v["name"],
            taluk            = v["taluk"],
            district         = v["district"],
            state            = v["state"],
            lat              = v["lat"],
            lng              = v["lng"],
            livestock_count  = v["livestock_count"],
            fmd_vax_coverage = v["fmd_vax_coverage"],
        ))
    db.commit()
    logger.info(f"Seeded {len(_DEMO_VILLAGES)} demo villages.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup:
      1. Create all SQLite tables (idempotent — safe to call every restart)
      2. Seed demo villages if empty
      3. Train ML models from existing DB reports
    """
    logger.info("=== Pashu Sentinel — SQLite Startup ===")

    # 1. Create tables
    Base.metadata.create_all(bind=engine)
    logger.info("SQLite tables created / verified.")

    # 2. Seed villages
    try:
        db = next(get_db())
        _seed_villages(db)
        seed_cases = case_repo.list_reports(db, limit=500)
        db.close()
    except Exception as exc:
        logger.warning(f"DB issue at startup ({exc}); continuing with empty seed.")
        seed_cases = []

    # 3. Train ML models
    enriched = []
    for c in seed_cases:
        ec = deepcopy(c)
        rf = ec.get("risk_factors", {})
        if rf and len(rf) == 4:
            ec["risk"] = calculate_risk(**rf)
        if not ec.get("syndrome"):
            ec["syndrome"] = classify_syndrome(ec.get("symptoms", []))
        enriched.append(ec)

    if_model   = IsolationForestTriage(contamination=0.15).fit(enriched)
    ewma_model = EWMAFarrington().build_series(enriched)
    set_models(if_model, ewma_model)

    logger.info(f"=== ML Engine ready — trained on {len(enriched)} cases ===")
    yield
    logger.info("Pashu Sentinel shutting down.")


app = FastAPI(
    title="Pashu Sentinel API",
    description=(
        "Smart livestock disease early-warning platform.\n\n"
        "**Database**: SQLite (zero-server, single .db file).\n"
        "**Intelligence Engine** (ref.md §10):\n"
        "- Tier 1: Isolation Forest case-level triage\n"
        "- Tier 2: EWMA + Noufaily-Farrington temporal aberration\n"
        "- Tier 3: DBSCAN spatio-temporal clustering (sklearn + Haversine)"
    ),
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|172\..*|192\..*)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Include Routers ──────────────────────────────────────────────────────────
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(reports_router)
app.include_router(cases_router)
app.include_router(risk_router)
app.include_router(spatial_router)
