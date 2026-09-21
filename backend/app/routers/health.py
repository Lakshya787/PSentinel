"""
app/routers/health.py — Health check & Syndromic definitions endpoints.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.ml_engine import SYNDROME_DEFINITIONS, get_ewma_model, get_if_model

router = APIRouter(tags=["Health"])


@router.get("/")
def health():
    if_model = get_if_model()
    ewma_model = get_ewma_model()
    return {
        "status":  "ok",
        "service": "pashu-sentinel-api",
        "version": "2.0.0",
        "database": "postgresql+postgis",
        "ml_engine": {
            "isolation_forest": if_model is not None and if_model._trained,
            "ewma_farrington":  ewma_model is not None,
        },
    }


@router.get("/health/db")
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


@router.get("/syndromes", tags=["Intelligence"])
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
