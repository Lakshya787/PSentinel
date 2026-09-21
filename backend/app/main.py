"""
app/main.py — Pashu Sentinel FastAPI application factory & entry point.
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from copy import deepcopy

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.session import get_db
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup: train ML models from DB seed data.
    Models are retrained from live DB rows so they stay current.
    """
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

# ─── Include Routers ──────────────────────────────────────────────────────────
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(reports_router)
app.include_router(cases_router)
app.include_router(risk_router)
app.include_router(spatial_router)
