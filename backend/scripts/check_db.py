"""
check_db.py — STEP 0 connection check.
Connects to Postgres, prints version + PostGIS extension status.
NEVER prints the URL or any credential.
"""
from __future__ import annotations
import sys
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

import os
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set in backend/.env")
    print("       See backend/.env.example for the format.")
    sys.exit(1)

# Normalise scheme only — no host rewriting
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = "postgresql+psycopg" + DATABASE_URL[len("postgresql"):]

from sqlalchemy import create_engine, text

engine = create_engine(DATABASE_URL, pool_pre_ping=True)

try:
    with engine.connect() as conn:
        pg_ver = conn.execute(text("SELECT version()")).scalar()
        postgis_ver = conn.execute(
            text("SELECT extversion FROM pg_extension WHERE extname = 'postgis'")
        ).scalar()
        utmzone = conn.execute(
            text("SELECT ST_SRID(ST_Transform(ST_MakePoint(73.87, 19.20), 32643))")
        ).scalar()

    print("[OK] PostgreSQL connected")
    print(f"     Server  : {pg_ver.split(',')[0]}")
    if postgis_ver:
        print(f"     PostGIS : {postgis_ver} ✓")
        print(f"     UTM43N  : SRID returned = {utmzone}")
    else:
        print("     PostGIS : NOT INSTALLED")
        print("     → Run in Supabase SQL editor: CREATE EXTENSION IF NOT EXISTS postgis CASCADE;")
        sys.exit(1)

except Exception as exc:
    print(f"[FAIL] {type(exc).__name__}: {exc}")
    sys.exit(1)
