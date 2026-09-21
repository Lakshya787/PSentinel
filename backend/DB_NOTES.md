# DB_NOTES.md — Pashu Sentinel Database Layer

## Schema Summary

Nine PostGIS tables (dependency order: villages → animals → vaccinations → reports → risk_assessments / lab_referrals / containment_zones → alerts → notifications).

| Table | Key Columns | Spatial |
|-------|-------------|---------|
| `villages` | id (UUID PK), name, taluk, district, state, livestock_count, fmd_vax_coverage | `geom POINT 4326` |
| `animals` | tag_id (PK), species, breed, age_years, owner_name, village_id FK | — |
| `vaccinations` | id, animal_id FK, disease, vaccinated_on | — |
| `reports` | id (UUID PK), **idempotency_key UNIQUE**, tag_id, animal_id FK, village_id FK, syndrome, symptoms JSONB, mortality, photos JSONB, geom, status, risk_factors JSONB, tier1_triage JSONB | `geom POINT 4326` |
| `risk_assessments` | id, report_id FK UNIQUE, crs numeric(5,2), tier, factors JSONB, computed_at | — |
| `lab_referrals` | id, report_id FK UNIQUE, sample_types JSONB, status, result JSONB, result_at | — |
| `containment_zones` | id, report_id FK, ring_km (3 or 10), created_at | `geom POLYGON 4326` |
| `alerts` | id, zone_id FK, language, message, recipient_count, sent_at | — |
| `notifications` | id, type, report_id FK, payload JSONB, created_at | — |

### Indexes
- `GIST` on `villages.geom`, `reports.geom`, `containment_zones.geom`
- `btree` on `reports(syndrome, received_at)`
- `UNIQUE` on `reports.idempotency_key`
- `UNIQUE` on `containment_zones(report_id, ring_km)`

### Row Level Security
All tables have RLS enabled with no policies — blocks Supabase public REST API but the backend's direct connection bypasses it.

---

## How to Run Migrations

```bash
cd backend

# Start local PostGIS (first time)
docker compose up -d

# Apply schema
alembic upgrade head

# Seed demo data (idempotent)
python seed.py

# Re-seed from scratch
python seed.py --reset
```

---

## How to Run the Backend

```bash
cd backend
uvicorn main:app --reload --port 8000
```

---

## Real Spatial SQL Used (all run against PostGIS, no Python simulation)

### a) Idempotent Ingestion — `repositories/cases.py`
```sql
INSERT INTO reports (id, idempotency_key, ...)
VALUES (:id, :idem_key, ...)
ON CONFLICT (idempotency_key) DO NOTHING
```
Replaying the same `idempotency_key` returns the existing row. `rowcount == 0` signals a duplicate to the caller.

### b) ST_DWithin Neighbouring Reports — `repositories/spatial.py :: neighbouring_reports()`
```sql
SELECT r.id, r.tag_id, r.village, r.syndrome,
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
```
`geography` cast ensures distances are in **metres** (not degrees). The GIST index on `reports.geom` accelerates the bounding-box pre-filter.

### c) ST_Buffer Containment Rings — `repositories/spatial.py :: create_containment_rings()`
```sql
INSERT INTO containment_zones (id, report_id, ring_km, geom, created_at)
VALUES (
    :zone_id, :report_id::uuid, :ring_km,
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
RETURNING id, ring_km, ST_AsGeoJSON(geom)::text AS geojson
```
`ST_Buffer(geography, metres)` produces a true geodesic circle. Villages inside each ring are found via a second `ST_DWithin` on `villages.geom`.

### d) ST_ClusterDBSCAN — `repositories/spatial.py :: postgis_cluster_dbscan()`
```sql
WITH clustered AS (
    SELECT id, tag_id, syndrome, village, geom,
        ST_ClusterDBSCAN(
            ST_Transform(geom, 32643),   -- EPSG:32643 = UTM Zone 43N (metres)
            eps       := :eps,            -- default 5000 m
            minpoints := :minpoints       -- default 3
        ) OVER () AS cluster_id
    FROM reports
    WHERE received_at >= now() - (:days * interval '1 day')
      AND geom IS NOT NULL
),
agg AS (
    SELECT cluster_id,
           count(*)                          AS case_count,
           json_agg(id::text)               AS case_ids,
           json_agg(DISTINCT village)       AS villages,
           json_agg(DISTINCT syndrome)      AS syndromes,
           max(received_at)                 AS latest_at,
           ST_AsGeoJSON(ST_ConvexHull(ST_Collect(geom)))::text AS hull_geojson
    FROM clustered
    WHERE cluster_id IS NOT NULL
    GROUP BY cluster_id
)
SELECT * FROM agg ORDER BY case_count DESC
```
EPSG:32643 (UTM Zone 43N, centred on 75°E) is used so `eps` is in metres. `eps` and `minpoints` are configurable constants in `repositories/spatial.py`.

### e) Nearest-Village KNN — `repositories/spatial.py :: nearest_village()`
```sql
SELECT id, name, livestock_count, fmd_vax_coverage,
       ST_Distance(geom::geography,
                   ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography) AS dist_m
FROM villages
WHERE geom IS NOT NULL
ORDER BY geom <-> ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)
LIMIT 1
```
The `<->` KNN operator uses the GIST index for O(log n) nearest-neighbour lookup.

---

## Real vs Simulated

| Feature | Status | Implementation |
|---------|--------|----------------|
| Idempotent ingestion | ✅ **Real PostGIS SQL** | `ON CONFLICT (idempotency_key) DO NOTHING` |
| ST_DWithin neighbours | ✅ **Real PostGIS SQL** | `geography` cast, GIST accelerated |
| ST_Buffer rings (3 km + 10 km) | ✅ **Real PostGIS SQL** | Stored as POLYGON rows, returned as GeoJSON |
| ST_ClusterDBSCAN | ✅ **Real PostGIS SQL** | Window function, UTM 43N projection |
| Nearest-village KNN | ✅ **Real PostGIS SQL** | `<->` operator, GIST index |
| Risk WLC calculation | ✅ Pure Python | `risk_engine.calculate_risk()` — deterministic, values-in/score-out |
| Isolation Forest (Tier 1) | ✅ Pure Python | `ml_engine.IsolationForestTriage` |
| EWMA Farrington (Tier 2) | ✅ Pure Python | `ml_engine.EWMAFarrington` |

---

## Environment Configuration

`db.py` resolves the connection in this order (first match wins):

| Priority | Variable(s) | Purpose |
|----------|-------------|---------|
| 1st | `DATABASE_URL` | Full psycopg3 connection URL (preferred) |
| 2nd | `DB_HOST` `DB_PORT` `DB_NAME` `DB_USER` `DB_PASS` | Assembled into a URL when `DATABASE_URL` is absent |
| Tuning | `ENVIRONMENT` | `"development"` (default) or `"production"` — scales pool size |
| Tuning | `DB_ECHO` | `"1"` logs every SQL statement to stderr (default `"0"`) |

**Local dev (Docker, Option A):**
```
DATABASE_URL=postgresql+psycopg://pashu:pashu_dev_password@localhost:5433/pashu_sentinel
```

**Local dev (Docker, Option B — component vars):**
```
DB_HOST=localhost
DB_PORT=5433
DB_NAME=pashu_sentinel
DB_USER=pashu
DB_PASS=pashu_dev_password
```

**Supabase session pooler:**
```
DATABASE_URL=postgresql+psycopg://postgres.PROJECTREF:PASSWORD@aws-X-REGION.pooler.supabase.com:5432/postgres
```

> ⚠️ Never commit `.env`. It is in `.gitignore`.
> ⚠️ `alembic.ini` does **not** hold credentials — `alembic/env.py` injects
>    `DATABASE_URL` at runtime via `config.set_main_option()`.
