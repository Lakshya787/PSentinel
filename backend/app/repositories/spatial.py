"""
app/repositories/spatial.py — All five required PostGIS queries (ref.md §11).

Every query here runs as REAL SQL against PostgreSQL + PostGIS.
No Python-level simulation.

Queries:
  a) Idempotent ingestion        → in cases.py (ON CONFLICT DO NOTHING)
  b) ST_DWithin neighbours       → neighbouring_reports()
  c) ST_Buffer containment rings → create_containment_rings()
  d) ST_ClusterDBSCAN outbreak   → postgis_cluster_dbscan()
  e) Nearest-village KNN         → nearest_village()
"""
from __future__ import annotations

import json
import uuid
from sqlalchemy import text
from sqlalchemy.orm import Session

# ─── Configurable constants ───────────────────────────────────────────────────
CLUSTER_EPS_METRES  = 5_000   # ST_ClusterDBSCAN eps — 5 km in UTM metres
CLUSTER_MIN_POINTS  = 3       # ST_ClusterDBSCAN minpoints
CLUSTER_DAYS        = 14      # window of recent reports

RING_3KM_METRES     = 3_000
RING_10KM_METRES    = 10_000


# ─── b) ST_DWithin neighbours ─────────────────────────────────────────────────

def neighbouring_reports(
    db:        Session,
    lat:       float,
    lon:       float,
    syndrome:  str,
    radius_m:  float = 15_000,
    days:      int   = 4,
    exclude_id: str  = None,
) -> list[dict]:
    """
    Find reports with the SAME syndrome within radius_m metres in the last `days` days.
    Uses geography cast so distances are true metres, not degrees.

    Feeds the 'spatial lag' factor of the WLC risk model (ref.md §13).
    """
    sql = text("""
        SELECT
            r.id,
            r.tag_id,
            r.village,
            r.taluk,
            r.syndrome,
            r.status,
            r.received_at,
            ST_Distance(
                r.geom::geography,
                ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
            ) AS dist_m
        FROM reports r
        WHERE
            r.syndrome = :syndrome
            AND r.received_at >= now() - (:days * interval '1 day')
            AND ST_DWithin(
                r.geom::geography,
                ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
                :radius_m
            )
            AND r.geom IS NOT NULL
            AND (:exclude_id IS NULL OR r.id::text != :exclude_id)
        ORDER BY dist_m ASC
    """)
    rows = db.execute(sql, {
        "lat":        lat,
        "lon":        lon,
        "syndrome":   syndrome,
        "radius_m":   radius_m,
        "days":       days,
        "exclude_id": exclude_id,
    }).fetchall()

    return [
        {
            "id":          str(r.id),
            "tag_id":      r.tag_id,
            "village":     r.village,
            "taluk":       r.taluk,
            "syndrome":    r.syndrome,
            "status":      r.status,
            "received_at": r.received_at.isoformat() if r.received_at else None,
            "dist_m":      round(float(r.dist_m), 1),
            "dist_km":     round(float(r.dist_m) / 1000, 2),
        }
        for r in rows
    ]


def compute_spatial_risk_factor(neighbours: list[dict]) -> float:
    """
    Convert PostGIS neighbour results into a spatial risk sub-score (0–100).
    More neighbours + closer distance → higher score. Used by WLC engine.
    """
    if not neighbours:
        return 20.0   # baseline — isolated case

    base = min(100.0, 40.0 + len(neighbours) * 15.0)
    boost = sum(max(0, 1 - n["dist_km"] / 5) * 5 for n in neighbours)
    return round(min(100.0, base + boost), 1)


# ─── c) ST_Buffer containment rings ──────────────────────────────────────────

def create_containment_rings(
    db: Session,
    report_id: str,
    lat: float,
    lon: float,
) -> list[dict]:
    """
    Create 3 km protection ring and 10 km surveillance ring as Polygon rows.

    ST_Buffer(point::geography, metres) returns a geography (true-distance circle).
    Cast back to geometry(POLYGON, 4326) for storage and GeoJSON output.
    """
    results = []

    for ring_km, radius_m in [(3, RING_3KM_METRES), (10, RING_10KM_METRES)]:
        zone_sql = text("""
            INSERT INTO containment_zones (id, report_id, ring_km, geom, created_at)
            VALUES (
                :zone_id,
                :report_id::uuid,
                :ring_km,
                ST_Buffer(
                    ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
                    :radius_m
                )::geometry,
                now()
            )
            ON CONFLICT (report_id, ring_km) DO UPDATE
                SET geom = ST_Buffer(
                    ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
                    :radius_m
                )::geometry
            RETURNING id, ring_km,
                      ST_AsGeoJSON(geom)::text AS geojson
        """)
        row = db.execute(zone_sql, {
            "zone_id":   str(uuid.uuid4()),
            "report_id": report_id,
            "ring_km":   ring_km,
            "lon":       lon,
            "lat":       lat,
            "radius_m":  radius_m,
        }).fetchone()

        vil_sql = text("""
            SELECT
                v.name,
                v.taluk,
                v.district,
                v.livestock_count,
                v.fmd_vax_coverage,
                ST_Distance(
                    v.geom::geography,
                    ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
                ) AS dist_m
            FROM villages v
            WHERE
                v.geom IS NOT NULL
                AND ST_DWithin(
                    v.geom::geography,
                    ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
                    :radius_m
                )
            ORDER BY dist_m ASC
        """)
        villages = db.execute(vil_sql, {"lon": lon, "lat": lat, "radius_m": radius_m}).fetchall()

        results.append({
            "zone_id":         str(row.id) if row else None,
            "ring_km":         ring_km,
            "radius_m":        radius_m,
            "geojson":         json.loads(row.geojson) if row and row.geojson else None,
            "villages_inside": [
                {
                    "name":             v.name,
                    "taluk":            v.taluk,
                    "district":         v.district,
                    "livestock_count":  v.livestock_count,
                    "fmd_vax_coverage": float(v.fmd_vax_coverage or 0),
                    "dist_km":          round(float(v.dist_m) / 1000, 2),
                    "vax_gap_pct":      round((1 - float(v.fmd_vax_coverage or 0)) * 100, 1),
                }
                for v in villages
            ],
        })

    db.commit()
    return results


# ─── d) ST_ClusterDBSCAN ──────────────────────────────────────────────────────

def postgis_cluster_dbscan(db: Session) -> dict:
    """
    Cluster recent reports using PostGIS ST_ClusterDBSCAN window function.

    • EPSG:32643 (UTM Zone 43N) transforms lat/lng to metres so eps=5000 = 5 km.
    • Returns cluster hulls as GeoJSON (ST_ConvexHull / ST_Collect).
    • Noise points (cluster_id IS NULL) are counted separately.
    """
    cluster_sql = text("""
        WITH clustered AS (
            SELECT
                id, tag_id, syndrome, village, taluk, district,
                received_at, status, geom,
                ST_ClusterDBSCAN(
                    ST_Transform(geom, 32643),
                    eps       := :eps,
                    minpoints := :minpoints
                ) OVER () AS cluster_id
            FROM reports
            WHERE
                received_at >= now() - (:days * interval '1 day')
                AND geom IS NOT NULL
        ),
        agg AS (
            SELECT
                cluster_id,
                count(*)                                          AS case_count,
                json_agg(id::text       ORDER BY received_at)    AS case_ids,
                json_agg(tag_id         ORDER BY received_at)    AS tag_ids,
                json_agg(DISTINCT village)                        AS villages,
                json_agg(DISTINCT syndrome)                       AS syndromes,
                max(received_at)                                  AS latest_at,
                ST_AsGeoJSON(
                    ST_ConvexHull(ST_Collect(geom))
                )::text                                           AS hull_geojson
            FROM clustered
            WHERE cluster_id IS NOT NULL
            GROUP BY cluster_id
        )
        SELECT * FROM agg ORDER BY case_count DESC
    """)

    noise_sql = text("""
        WITH clustered AS (
            SELECT
                ST_ClusterDBSCAN(
                    ST_Transform(geom, 32643),
                    eps       := :eps,
                    minpoints := :minpoints
                ) OVER () AS cluster_id
            FROM reports
            WHERE
                received_at >= now() - (:days * interval '1 day')
                AND geom IS NOT NULL
        )
        SELECT
            count(*)                                     AS total,
            count(*) FILTER (WHERE cluster_id IS NULL)   AS noise_count,
            count(*) FILTER (WHERE cluster_id IS NOT NULL) AS clustered_count
        FROM clustered
    """)

    params = {"eps": CLUSTER_EPS_METRES, "minpoints": CLUSTER_MIN_POINTS, "days": CLUSTER_DAYS}
    cluster_rows = db.execute(cluster_sql, params).fetchall()
    stats        = db.execute(noise_sql,   params).fetchone()

    clusters = [
        {
            "cluster_id":   r.cluster_id,
            "case_count":   r.case_count,
            "case_ids":     r.case_ids,
            "tag_ids":      r.tag_ids,
            "villages":     r.villages,
            "syndromes":    r.syndromes,
            "latest_at":    r.latest_at.isoformat() if r.latest_at else None,
            "hull_geojson": json.loads(r.hull_geojson) if r.hull_geojson else None,
        }
        for r in cluster_rows
    ]

    return {
        "total_cases":    int(stats.total)          if stats else 0,
        "clustered":      int(stats.clustered_count) if stats else 0,
        "isolated_noise": int(stats.noise_count)    if stats else 0,
        "cluster_count":  len(clusters),
        "clusters":       clusters,
        "parameters": {
            "algorithm":       "ST_ClusterDBSCAN (PostGIS)",
            "eps_metres":      CLUSTER_EPS_METRES,
            "min_points":      CLUSTER_MIN_POINTS,
            "days":            CLUSTER_DAYS,
            "srid":            32643,
            "srid_name":       "UTM Zone 43N",
        },
    }


# ─── e) Nearest-village KNN lookup ───────────────────────────────────────────

def nearest_village(db: Session, lat: float, lon: float) -> dict | None:
    """
    KNN nearest-village using PostGIS <-> operator (index-assisted, O(log n)).
    Used to look up livestock density and FMD vax coverage for risk scoring.
    """
    sql = text("""
        SELECT
            id,
            name,
            taluk,
            district,
            livestock_count,
            fmd_vax_coverage,
            ST_Distance(
                geom::geography,
                ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
            ) AS dist_m
        FROM villages
        WHERE geom IS NOT NULL
        ORDER BY geom <-> ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)
        LIMIT 1
    """)
    r = db.execute(sql, {"lat": lat, "lon": lon}).fetchone()
    if not r:
        return None
    return {
        "id":               str(r.id),
        "name":             r.name,
        "taluk":            r.taluk,
        "district":         r.district,
        "livestock_count":  r.livestock_count,
        "fmd_vax_coverage": float(r.fmd_vax_coverage or 0),
        "dist_km":          round(float(r.dist_m) / 1000, 2),
    }


# ─── EXPLAIN helper (for verification) ───────────────────────────────────────

def explain_dwithin(
    db: Session, lat: float, lon: float, syndrome: str, radius_m: float = 15_000
) -> list[str]:
    """Run EXPLAIN (not ANALYZE) on the ST_DWithin query and return plan lines."""
    sql = text("""
        EXPLAIN
        SELECT id, tag_id FROM reports r
        WHERE
            r.syndrome = :syndrome
            AND ST_DWithin(
                r.geom::geography,
                ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
                :radius_m
            )
            AND r.geom IS NOT NULL
    """)
    rows = db.execute(sql, {"lat": lat, "lon": lon, "syndrome": syndrome, "radius_m": radius_m}).fetchall()
    return [r[0] for r in rows]
