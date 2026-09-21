"""
app/routers/spatial.py — Spatial queries (neighbours & DBSCAN clustering) router.

SQLite edition: uses Haversine neighbours and sklearn DBSCAN (via spatial_repo).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.repositories import cases as case_repo
from app.repositories import spatial as spatial_repo

router = APIRouter(tags=["Spatial", "Intelligence"])


@router.get("/neighbors/{case_id}")
@router.get("/neighbours/{case_id}")
def get_neighbours(
    case_id:  str,
    radius_m: float = Query(15000, description="Search radius in metres"),
    days:     int   = Query(4,     description="Look-back window in days"),
    db:       Session = Depends(get_db),
):
    """Haversine neighbouring reports with same syndrome."""
    case = case_repo.get_report_orm(db, case_id)
    if not case:
        raise HTTPException(404, f"Case '{case_id}' not found.")
    lat, lng = case.lat, case.lng
    if lat is None or lng is None:
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


@router.get("/clusters")
def get_clusters(db: Session = Depends(get_db)):
    """
    DBSCAN cluster view — sklearn with Haversine metric.
    eps=5 km, minpoints=3, window=14 days.
    """
    return spatial_repo.postgis_cluster_dbscan(db)
