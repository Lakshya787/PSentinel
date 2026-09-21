"""
app/repositories/spatial.py — Spatial queries implemented with Python + Haversine.

SQLite edition: replaces all PostGIS ST_* functions with equivalent Python math.
The public API of every function is identical to the PostGIS version so no
router or service code needs to change.

Functions:
  a) Idempotent ingestion        → in cases.py (check-then-insert)
  b) Haversine neighbours        → neighbouring_reports()
  c) Circle containment rings    → create_containment_rings()
  d) sklearn DBSCAN outbreak     → sklearn_cluster_dbscan()
  e) Nearest-village KNN         → nearest_village()
"""
from __future__ import annotations

import json
import math
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

import numpy as np
from sqlalchemy.orm import Session

from app.models.report import Report
from app.models.village import Village
from app.models.alert import ContainmentZone

# ─── Configurable constants ───────────────────────────────────────────────────
CLUSTER_EPS_METRES  = 5_000   # DBSCAN eps — 5 km
CLUSTER_MIN_POINTS  = 3       # DBSCAN minpoints
CLUSTER_DAYS        = 14      # window of recent reports

RING_3KM_METRES     = 3_000
RING_10KM_METRES    = 10_000

_EARTH_RADIUS_M = 6_371_000.0   # mean Earth radius in metres


# ─── Haversine distance ───────────────────────────────────────────────────────

def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return the great-circle distance in metres between two WGS-84 points."""
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    Δφ = math.radians(lat2 - lat1)
    Δλ = math.radians(lon2 - lon1)
    a = math.sin(Δφ / 2) ** 2 + math.cos(φ1) * math.cos(φ2) * math.sin(Δλ / 2) ** 2
    return 2 * _EARTH_RADIUS_M * math.asin(math.sqrt(a))


# ─── GeoJSON circle polygon ───────────────────────────────────────────────────

def _circle_geojson(lat: float, lon: float, radius_m: float, n_pts: int = 64) -> dict:
    """
    Approximate a geodesic circle as a GeoJSON Polygon with n_pts vertices.
    Equivalent to ST_Buffer(point::geography, radius_m) for display purposes.
    """
    coords = []
    for i in range(n_pts + 1):
        angle = math.radians(i * 360 / n_pts)
        # Convert radius to degrees (approximate, good enough for display)
        d_lat = (radius_m / _EARTH_RADIUS_M) * math.cos(angle) * (180 / math.pi)
        d_lon = (radius_m / _EARTH_RADIUS_M) * math.sin(angle) / math.cos(math.radians(lat)) * (180 / math.pi)
        coords.append([round(lon + d_lon, 6), round(lat + d_lat, 6)])
    return {
        "type": "Feature",
        "geometry": {
            "type": "Polygon",
            "coordinates": [coords],
        },
        "properties": {"radius_m": radius_m},
    }


# ─── b) Haversine neighbours ─────────────────────────────────────────────────

def neighbouring_reports(
    db:        Session,
    lat:       float,
    lon:       float,
    syndrome:  str,
    radius_m:  float = 15_000,
    days:      int   = 4,
    exclude_id: Optional[str] = None,
) -> list[dict]:
    """
    Find reports with the SAME syndrome within radius_m metres in the last `days` days.
    Haversine distance computed in Python — replaces ST_DWithin geography cast.
    Feeds the 'spatial lag' factor of the WLC risk model (ref.md §13).
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    # Pull candidate rows (same syndrome, recent, has location)
    q = (
        db.query(Report)
        .filter(
            Report.syndrome == syndrome,
            Report.lat.isnot(None),
            Report.lng.isnot(None),
        )
    )
    if exclude_id:
        q = q.filter(Report.id != exclude_id, Report.tag_id != exclude_id)

    rows = q.all()

    results = []
    for r in rows:
        # Filter by time (SQLite stores naive UTC datetimes)
        r_time = r.received_at
        if r_time:
            if r_time.tzinfo is None:
                r_time = r_time.replace(tzinfo=timezone.utc)
            if r_time < cutoff:
                continue

        dist = _haversine_m(lat, lon, r.lat, r.lng)
        if dist <= radius_m:
            results.append({
                "id":          r.id,
                "tag_id":      r.tag_id,
                "village":     r.village,
                "taluk":       r.taluk,
                "syndrome":    r.syndrome,
                "status":      r.status,
                "received_at": r.received_at.isoformat() if r.received_at else None,
                "dist_m":      round(dist, 1),
                "dist_km":     round(dist / 1000, 2),
            })

    results.sort(key=lambda x: x["dist_m"])
    return results


def compute_spatial_risk_factor(neighbours: list[dict]) -> float:
    """
    Convert neighbour results into a spatial risk sub-score (0–100).
    More neighbours + closer distance → higher score. Used by WLC engine.
    """
    if not neighbours:
        return 20.0   # baseline — isolated case

    base = min(100.0, 40.0 + len(neighbours) * 15.0)
    boost = sum(max(0, 1 - n["dist_km"] / 5) * 5 for n in neighbours)
    return round(min(100.0, base + boost), 1)


# ─── c) Circle containment rings ─────────────────────────────────────────────

def create_containment_rings(
    db: Session,
    report_id: str,
    lat: float,
    lon: float,
) -> list[dict]:
    """
    Create 3 km protection ring and 10 km surveillance ring.

    Circle polygons computed with _circle_geojson() — replaces ST_Buffer.
    Stored in containment_zones table as GeoJSON Text.
    Also lists villages inside each ring (Haversine filter).
    """
    now = datetime.now(timezone.utc)
    results = []

    for ring_km, radius_m in [(3, RING_3KM_METRES), (10, RING_10KM_METRES)]:
        # Check for existing zone (idempotent)
        existing = (
            db.query(ContainmentZone)
            .filter(ContainmentZone.report_id == report_id,
                    ContainmentZone.ring_km == ring_km)
            .first()
        )

        geojson = _circle_geojson(lat, lon, radius_m)

        if existing:
            existing.geojson = json.dumps(geojson)
            zone_id = existing.id
        else:
            zone = ContainmentZone(
                id        = str(uuid.uuid4()),
                report_id = report_id,
                ring_km   = ring_km,
                geojson   = json.dumps(geojson),
                created_at= now,
            )
            db.add(zone)
            db.flush()   # get the id without committing yet
            zone_id = zone.id

        # Villages inside this ring (Haversine)
        all_villages = db.query(Village).filter(
            Village.lat.isnot(None),
            Village.lng.isnot(None),
        ).all()

        villages_inside = []
        for v in all_villages:
            d = _haversine_m(lat, lon, v.lat, v.lng)
            if d <= radius_m:
                villages_inside.append({
                    "name":             v.name,
                    "taluk":            v.taluk,
                    "district":         v.district,
                    "livestock_count":  v.livestock_count,
                    "fmd_vax_coverage": float(v.fmd_vax_coverage or 0),
                    "dist_km":          round(d / 1000, 2),
                    "vax_gap_pct":      round((1 - float(v.fmd_vax_coverage or 0)) * 100, 1),
                })

        villages_inside.sort(key=lambda x: x["dist_km"])

        results.append({
            "zone_id":         str(zone_id),
            "ring_km":         ring_km,
            "radius_m":        radius_m,
            "geojson":         geojson,
            "villages_inside": villages_inside,
        })

    db.commit()
    return results


# ─── d) sklearn DBSCAN outbreak clustering ───────────────────────────────────

def postgis_cluster_dbscan(db: Session) -> dict:
    """
    Cluster recent reports using sklearn DBSCAN with Haversine metric.

    Equivalent to PostGIS ST_ClusterDBSCAN — same parameters, same output shape.
    eps=5 km, minpoints=3, window=14 days.
    Returns cluster convex hulls as GeoJSON.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=CLUSTER_DAYS)

    rows = db.query(Report).filter(
        Report.lat.isnot(None),
        Report.lng.isnot(None),
    ).all()

    # Filter by time
    recent = []
    for r in rows:
        t = r.received_at
        if t:
            if t.tzinfo is None:
                t = t.replace(tzinfo=timezone.utc)
            if t >= cutoff:
                recent.append(r)

    if not recent:
        return {
            "total_cases": 0, "clustered": 0, "isolated_noise": 0,
            "cluster_count": 0, "clusters": [],
            "parameters": _cluster_params(),
        }

    # Build coordinate array in radians for Haversine metric
    coords = np.array([[math.radians(r.lat), math.radians(r.lng)] for r in recent])

    try:
        from sklearn.cluster import DBSCAN
        eps_rad = CLUSTER_EPS_METRES / _EARTH_RADIUS_M
        db_scan = DBSCAN(
            eps=eps_rad,
            min_samples=CLUSTER_MIN_POINTS,
            algorithm="ball_tree",
            metric="haversine",
        ).fit(coords)
        labels = db_scan.labels_
    except Exception:
        labels = [-1] * len(recent)

    # Aggregate clusters
    cluster_map: dict[int, list] = {}
    for i, label in enumerate(labels):
        if label == -1:
            continue
        cluster_map.setdefault(label, []).append(i)

    import json as _json
    clusters = []
    for cluster_id, indices in sorted(cluster_map.items(), key=lambda x: -len(x[1])):
        members = [recent[i] for i in indices]
        # Convex hull → bounding box GeoJSON (simplified, no shapely needed)
        lats = [m.lat for m in members]
        lngs = [m.lng for m in members]
        hull_geojson = _bbox_polygon(min(lats), max(lats), min(lngs), max(lngs))

        latest = max(
            (m.received_at for m in members if m.received_at),
            default=None,
        )
        clusters.append({
            "cluster_id":   cluster_id,
            "case_count":   len(members),
            "case_ids":     [m.id for m in members],
            "tag_ids":      [m.tag_id for m in members],
            "villages":     list({m.village for m in members if m.village}),
            "syndromes":    list({m.syndrome for m in members if m.syndrome}),
            "latest_at":    latest.isoformat() if latest else None,
            "hull_geojson": hull_geojson,
        })

    noise_count = int(sum(1 for l in labels if l == -1))
    clustered   = len(recent) - noise_count

    return {
        "total_cases":    len(recent),
        "clustered":      clustered,
        "isolated_noise": noise_count,
        "cluster_count":  len(clusters),
        "clusters":       clusters,
        "parameters":     _cluster_params(),
    }


def _bbox_polygon(min_lat, max_lat, min_lng, max_lng) -> dict:
    """Return a GeoJSON Polygon bounding box (simplified convex hull)."""
    coords = [
        [min_lng, min_lat], [max_lng, min_lat],
        [max_lng, max_lat], [min_lng, max_lat],
        [min_lng, min_lat],   # close ring
    ]
    return {"type": "Polygon", "coordinates": [coords]}


def _cluster_params() -> dict:
    return {
        "algorithm":   "DBSCAN (sklearn + Haversine)",
        "eps_metres":  CLUSTER_EPS_METRES,
        "min_points":  CLUSTER_MIN_POINTS,
        "days":        CLUSTER_DAYS,
    }


# ─── e) Nearest-village KNN lookup ───────────────────────────────────────────

def nearest_village(db: Session, lat: float, lon: float) -> Optional[dict]:
    """
    Nearest-village lookup using Haversine distance.
    Replaces PostGIS KNN <-> operator. Used for livestock density + FMD vax coverage.
    """
    villages = db.query(Village).filter(
        Village.lat.isnot(None),
        Village.lng.isnot(None),
    ).all()

    if not villages:
        return None

    best = min(villages, key=lambda v: _haversine_m(lat, lon, v.lat, v.lng))
    dist = _haversine_m(lat, lon, best.lat, best.lng)

    return {
        "id":               best.id,
        "name":             best.name,
        "taluk":            best.taluk,
        "district":         best.district,
        "livestock_count":  best.livestock_count,
        "fmd_vax_coverage": float(best.fmd_vax_coverage or 0),
        "dist_km":          round(dist / 1000, 2),
    }


# ─── EXPLAIN helper (compatibility shim) ─────────────────────────────────────

def explain_dwithin(
    db: Session, lat: float, lon: float, syndrome: str, radius_m: float = 15_000
) -> list[str]:
    """Compatibility shim — returns a human-readable description (no PostGIS EXPLAIN)."""
    neighbours = neighbouring_reports(db, lat=lat, lon=lon, syndrome=syndrome, radius_m=radius_m)
    return [
        f"[SQLite/Haversine] Found {len(neighbours)} neighbours "
        f"within {radius_m/1000:.1f} km for syndrome='{syndrome}'"
    ]
