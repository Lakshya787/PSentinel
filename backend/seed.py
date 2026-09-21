"""
seed.py — Idempotent Pashu Sentinel demo seeder (ref.md §24 Khandala walkthrough).

Usage:
  python seed.py          # seed only if tables are empty
  python seed.py --reset  # wipe all data and re-seed

Guarantees:
  - Running twice creates ZERO duplicate rows (all inserts use ON CONFLICT DO NOTHING).
  - Khandala has ~0.59 FMD vaccination coverage (41% gap).
  - Two prior vesicular reports within 15 km of Khandala, timestamped within the
    last 4 days, so the ST_DWithin query in the Khandala replay finds them.
"""
from __future__ import annotations

import argparse
import json
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

from sqlalchemy import text
from db import SessionLocal

# ─── Helpers ─────────────────────────────────────────────────────────────────

def now() -> datetime:
    return datetime.now(timezone.utc)

def ago(days: float = 0, hours: float = 0) -> datetime:
    return now() - timedelta(days=days, hours=hours)

def uid() -> str:
    return str(uuid.uuid4())


# ─── Village data — 30+ villages across Pune, Ahmednagar, Satara ─────────────

VILLAGES = [
    # ── Junnar Taluk, Pune (primary outbreak zone) ────────────────────────────
    {"name": "Khandala",        "taluk": "Junnar",     "district": "Pune",      "state": "Maharashtra", "lat": 19.2081, "lng": 73.8742, "livestock": 1840, "vax": 0.59},
    {"name": "Narayangaon",     "taluk": "Junnar",     "district": "Pune",      "state": "Maharashtra", "lat": 19.1740, "lng": 73.9862, "livestock": 2100, "vax": 0.72},
    {"name": "Alephata",        "taluk": "Junnar",     "district": "Pune",      "state": "Maharashtra", "lat": 19.1150, "lng": 73.9280, "livestock": 1650, "vax": 0.65},
    {"name": "Otur",            "taluk": "Junnar",     "district": "Pune",      "state": "Maharashtra", "lat": 19.1560, "lng": 73.8920, "livestock": 920,  "vax": 0.81},
    {"name": "Manchar",         "taluk": "Ambegaon",   "district": "Pune",      "state": "Maharashtra", "lat": 18.9860, "lng": 73.9230, "livestock": 1320, "vax": 0.77},
    {"name": "Rajuri",          "taluk": "Junnar",     "district": "Pune",      "state": "Maharashtra", "lat": 19.0730, "lng": 73.8820, "livestock": 780,  "vax": 0.68},
    {"name": "Ale",             "taluk": "Junnar",     "district": "Pune",      "state": "Maharashtra", "lat": 19.2300, "lng": 73.9600, "livestock": 1100, "vax": 0.74},
    {"name": "Wadaj",           "taluk": "Junnar",     "district": "Pune",      "state": "Maharashtra", "lat": 19.1900, "lng": 74.0100, "livestock": 640,  "vax": 0.62},
    {"name": "Ambegaon",        "taluk": "Ambegaon",   "district": "Pune",      "state": "Maharashtra", "lat": 19.1200, "lng": 73.7300, "livestock": 1050, "vax": 0.70},
    {"name": "Khed",            "taluk": "Khed",       "district": "Pune",      "state": "Maharashtra", "lat": 18.8570, "lng": 73.8870, "livestock": 1760, "vax": 0.76},
    # ── Ahmednagar district ────────────────────────────────────────────────────
    {"name": "Sangamner",       "taluk": "Sangamner",  "district": "Ahmednagar","state": "Maharashtra", "lat": 19.5700, "lng": 74.2100, "livestock": 2400, "vax": 0.83},
    {"name": "Akole",           "taluk": "Akole",      "district": "Ahmednagar","state": "Maharashtra", "lat": 19.5600, "lng": 73.9900, "livestock": 1820, "vax": 0.71},
    {"name": "Shrigonda",       "taluk": "Shrigonda",  "district": "Ahmednagar","state": "Maharashtra", "lat": 18.6200, "lng": 74.7100, "livestock": 2150, "vax": 0.79},
    {"name": "Karjat",          "taluk": "Karjat",     "district": "Ahmednagar","state": "Maharashtra", "lat": 18.9100, "lng": 74.5800, "livestock": 1380, "vax": 0.66},
    {"name": "Rahata",          "taluk": "Rahata",     "district": "Ahmednagar","state": "Maharashtra", "lat": 19.7100, "lng": 74.4800, "livestock": 3100, "vax": 0.88},
    {"name": "Nevasa",          "taluk": "Nevasa",     "district": "Ahmednagar","state": "Maharashtra", "lat": 19.5500, "lng": 75.0000, "livestock": 1650, "vax": 0.73},
    {"name": "Pathardi",        "taluk": "Pathardi",   "district": "Ahmednagar","state": "Maharashtra", "lat": 19.1900, "lng": 75.1800, "livestock": 1290, "vax": 0.69},
    {"name": "Shevgaon",        "taluk": "Shevgaon",   "district": "Ahmednagar","state": "Maharashtra", "lat": 19.3500, "lng": 75.6900, "livestock": 1780, "vax": 0.78},
    # ── Satara district ────────────────────────────────────────────────────────
    {"name": "Wai",             "taluk": "Wai",        "district": "Satara",    "state": "Maharashtra", "lat": 17.9600, "lng": 73.8900, "livestock": 1450, "vax": 0.75},
    {"name": "Mahabaleshwar",   "taluk": "Jawali",     "district": "Satara",    "state": "Maharashtra", "lat": 17.9240, "lng": 73.6570, "livestock": 420,  "vax": 0.84},
    {"name": "Patan",           "taluk": "Patan",      "district": "Satara",    "state": "Maharashtra", "lat": 17.3800, "lng": 73.8900, "livestock": 2200, "vax": 0.67},
    {"name": "Karad",           "taluk": "Karad",      "district": "Satara",    "state": "Maharashtra", "lat": 17.2900, "lng": 74.1800, "livestock": 2850, "vax": 0.82},
    {"name": "Satara",          "taluk": "Satara",     "district": "Satara",    "state": "Maharashtra", "lat": 17.6850, "lng": 73.9900, "livestock": 1920, "vax": 0.80},
    {"name": "Koregaon",        "taluk": "Koregaon",   "district": "Satara",    "state": "Maharashtra", "lat": 17.6900, "lng": 74.1600, "livestock": 1340, "vax": 0.71},
    # ── Additional Pune villages ───────────────────────────────────────────────
    {"name": "Bhor",            "taluk": "Bhor",       "district": "Pune",      "state": "Maharashtra", "lat": 18.1500, "lng": 73.8400, "livestock": 890,  "vax": 0.72},
    {"name": "Velhe",           "taluk": "Velhe",      "district": "Pune",      "state": "Maharashtra", "lat": 18.2100, "lng": 73.6300, "livestock": 620,  "vax": 0.58},
    {"name": "Purandar",        "taluk": "Purandar",   "district": "Pune",      "state": "Maharashtra", "lat": 18.2900, "lng": 73.9900, "livestock": 1150, "vax": 0.76},
    {"name": "Daund",           "taluk": "Daund",      "district": "Pune",      "state": "Maharashtra", "lat": 18.4600, "lng": 74.5800, "livestock": 2310, "vax": 0.81},
    {"name": "Shirur",          "taluk": "Shirur",     "district": "Pune",      "state": "Maharashtra", "lat": 18.8200, "lng": 74.3600, "livestock": 1870, "vax": 0.74},
    {"name": "Indapur",         "taluk": "Indapur",    "district": "Pune",      "state": "Maharashtra", "lat": 18.1200, "lng": 75.0200, "livestock": 2640, "vax": 0.77},
]

# ─── Animals ──────────────────────────────────────────────────────────────────

ANIMALS = [
    {"tag_id": "COW-1024",    "species": "Cattle", "breed": "Gir",         "age": 4.0},
    {"tag_id": "COW-1025",    "species": "Cattle", "breed": "Khillari",    "age": 6.0},
    {"tag_id": "GOAT-0310",   "species": "Goat",   "breed": "Osmanabadi",  "age": 2.0},
    {"tag_id": "BUF-0881",    "species": "Buffalo","breed": "Murrah",      "age": 5.0},
    {"tag_id": "SHP-0201",    "species": "Sheep",  "breed": "Deccani",     "age": 3.0},
    {"tag_id": "100293849102","species": "Cattle", "breed": "Sahiwal",     "age": 3.5},  # Khandala replay animal
    {"tag_id": "COW-2001",    "species": "Cattle", "breed": "Gir",         "age": 7.0},
    {"tag_id": "COW-2002",    "species": "Cattle", "breed": "Sahiwal",     "age": 5.0},
    {"tag_id": "COW-9001",    "species": "Cattle", "breed": "Khillari",    "age": 4.0},  # Narayangaon prior
    {"tag_id": "COW-9002",    "species": "Cattle", "breed": "Gir",         "age": 3.0},  # Alephata prior
]

# ─── Seeded reports ───────────────────────────────────────────────────────────
# NOTE: Narayangaon and Alephata are within ~7 km of Khandala.
# Their timestamps are within the last 4 days so ST_DWithin finds them.

REPORTS = [
    # ── Prior vesicular reports near Khandala (within 4 days) ─────────────────
    {
        "idem_key":   "seed-prior-narayangaon-2026",
        "tag_id":     "COW-9001",
        "animal_id":  "COW-9001",
        "village":    "Narayangaon",
        "taluk":      "Junnar",
        "district":   "Pune",
        "species":    "Cattle",
        "breed":      "Khillari",
        "lat":        19.1740,
        "lng":        73.9862,
        "syndrome":   "Vesicular / Podal Syndrome",
        "symptoms":   ["Fever", "Oral Blisters", "Excessive Salivation"],
        "mortality":  0,
        "affected":   2,
        "reported_by":"Pashu Sakhi Narayangaon",
        "status":     "UNDER_INVESTIGATION",
        "risk_factors": {"clinical": 75, "vaccination": 65, "environmental": 70, "spatial": 80},
        "notes":      "Seed: prior vesicular report near Khandala",
        "hours_ago":  72,   # 3 days ago — within the 4-day ST_DWithin window
    },
    {
        "idem_key":   "seed-prior-alephata-2026",
        "tag_id":     "COW-9002",
        "animal_id":  "COW-9002",
        "village":    "Alephata",
        "taluk":      "Junnar",
        "district":   "Pune",
        "species":    "Cattle",
        "breed":      "Gir",
        "lat":        19.1150,
        "lng":        73.9280,
        "syndrome":   "Vesicular / Podal Syndrome",
        "symptoms":   ["Fever", "Lameness", "Oral Vesicles"],
        "mortality":  0,
        "affected":   3,
        "reported_by":"Field Worker Alephata",
        "status":     "RISK_ANALYZED",
        "risk_factors": {"clinical": 78, "vaccination": 60, "environmental": 72, "spatial": 85},
        "notes":      "Seed: prior vesicular report near Khandala",
        "hours_ago":  48,   # 2 days ago
    },
    # ── Primary Khandala case (COW-1024) ─────────────────────────────────────
    {
        "idem_key":   "seed-khandala-primary-cow1024",
        "tag_id":     "COW-1024",
        "animal_id":  "COW-1024",
        "village":    "Khandala",
        "taluk":      "Junnar",
        "district":   "Pune",
        "species":    "Cattle",
        "breed":      "Gir",
        "lat":        18.7831,
        "lng":        73.9286,
        "syndrome":   "Vesicular / Podal Syndrome",
        "symptoms":   ["Fever", "Oral vesicles", "Excessive salivation", "Lameness"],
        "mortality":  1,
        "affected":   3,
        "reported_by":"Pashu Sakhi",
        "status":     "RISK_ANALYZED",
        "risk_factors": {"clinical": 92, "vaccination": 80, "environmental": 85, "spatial": 95},
        "notes":      "Owner reports 3 more animals showing similar symptoms.",
        "hours_ago":  10,
    },
    # ── Other cluster cases ────────────────────────────────────────────────────
    {
        "idem_key":   "seed-khandala-cluster-cow1025",
        "tag_id":     "COW-1025",
        "animal_id":  "COW-1025",
        "village":    "Khandala",
        "taluk":      "Junnar",
        "district":   "Pune",
        "species":    "Cattle",
        "breed":      "Khillari",
        "lat":        18.7860,
        "lng":        73.9310,
        "syndrome":   "Vesicular / Podal Syndrome",
        "symptoms":   ["Fever", "Oral vesicles"],
        "mortality":  0,
        "affected":   2,
        "reported_by":"Pashu Sakhi",
        "status":     "REPORTED",
        "risk_factors": {"clinical": 78, "vaccination": 70, "environmental": 82, "spatial": 93},
        "notes":      "",
        "hours_ago":  8,
    },
    {
        "idem_key":   "seed-khandala-goat0310",
        "tag_id":     "GOAT-0310",
        "animal_id":  "GOAT-0310",
        "village":    "Khandala",
        "taluk":      "Junnar",
        "district":   "Pune",
        "species":    "Goat",
        "breed":      "Osmanabadi",
        "lat":        18.7812,
        "lng":        73.9255,
        "syndrome":   "Vesicular / Podal Syndrome",
        "symptoms":   ["Fever", "Lameness"],
        "mortality":  0,
        "affected":   4,
        "reported_by":"Field Worker",
        "status":     "REPORTED",
        "risk_factors": {"clinical": 70, "vaccination": 60, "environmental": 75, "spatial": 88},
        "notes":      "",
        "hours_ago":  6,
    },
    # ── Respiratory case in Sangamner ─────────────────────────────────────────
    {
        "idem_key":   "seed-sangamner-respiratory",
        "tag_id":     "BUF-0881",
        "animal_id":  "BUF-0881",
        "village":    "Sangamner",
        "taluk":      "Sangamner",
        "district":   "Ahmednagar",
        "species":    "Buffalo",
        "breed":      "Murrah",
        "lat":        19.5700,
        "lng":        74.2100,
        "syndrome":   "Acute Respiratory Syndrome",
        "symptoms":   ["Coughing", "Nasal discharge", "Fever"],
        "mortality":  0,
        "affected":   5,
        "reported_by":"VET-003",
        "status":     "LAB_TESTING",
        "risk_factors": {"clinical": 65, "vaccination": 55, "environmental": 60, "spatial": 45},
        "notes":      "Possible HS or BRDC",
        "hours_ago":  36,
    },
    # ── Historical cases for time-series ──────────────────────────────────────
    {
        "idem_key":   "seed-historical-otur-1",
        "tag_id":     "SHP-0201",
        "animal_id":  "SHP-0201",
        "village":    "Otur",
        "taluk":      "Junnar",
        "district":   "Pune",
        "species":    "Sheep",
        "breed":      "Deccani",
        "lat":        19.1560,
        "lng":        73.8920,
        "syndrome":   "Cutaneous / Nodular Pox-like Syndrome",
        "symptoms":   ["Skin nodules", "Fever", "Swollen lymph nodes"],
        "mortality":  1,
        "affected":   8,
        "reported_by":"Field Worker",
        "status":     "LAB_CONFIRMED",
        "risk_factors": {"clinical": 80, "vaccination": 40, "environmental": 65, "spatial": 55},
        "notes":      "Suspected sheep pox",
        "hours_ago":  240,   # 10 days ago — outside 4-day window
    },
    {
        "idem_key":   "seed-historical-rajuri-1",
        "tag_id":     "COW-2001",
        "animal_id":  "COW-2001",
        "village":    "Rajuri",
        "taluk":      "Junnar",
        "district":   "Pune",
        "species":    "Cattle",
        "breed":      "Gir",
        "lat":        19.0730,
        "lng":        73.8820,
        "syndrome":   "Enteric / Diarrheal Syndrome",
        "symptoms":   ["Diarrhoea", "Anorexia", "Dehydration"],
        "mortality":  2,
        "affected":   6,
        "reported_by":"VET-002",
        "status":     "CONTAINMENT",
        "risk_factors": {"clinical": 82, "vaccination": 50, "environmental": 78, "spatial": 62},
        "notes":      "BVD suspected",
        "hours_ago":  168,   # 7 days ago
    },
    {
        "idem_key":   "seed-historical-manchar-1",
        "tag_id":     "COW-2002",
        "animal_id":  "COW-2002",
        "village":    "Manchar",
        "taluk":      "Ambegaon",
        "district":   "Pune",
        "species":    "Cattle",
        "breed":      "Sahiwal",
        "lat":        18.9860,
        "lng":        73.9230,
        "syndrome":   "Vesicular / Podal Syndrome",
        "symptoms":   ["Fever", "Oral vesicles"],
        "mortality":  0,
        "affected":   2,
        "reported_by":"Pashu Sakhi Manchar",
        "status":     "ALERT_SENT",
        "risk_factors": {"clinical": 74, "vaccination": 68, "environmental": 70, "spatial": 76},
        "notes":      "FMD suspect",
        "hours_ago":  120,   # 5 days ago
    },
]


# ─── Seeder functions ─────────────────────────────────────────────────────────

def seed_villages(db):
    print("  Seeding villages…")
    n = 0
    for v in VILLAGES:
        result = db.execute(text("""
            INSERT INTO villages (id, name, taluk, district, state, geom, livestock_count, fmd_vax_coverage)
            VALUES (
                :id, :name, :taluk, :district, :state,
                ST_SetSRID(ST_MakePoint(:lng, :lat), 4326),
                :livestock, :vax
            )
            ON CONFLICT DO NOTHING
        """), {
            "id":       uid(),
            "name":     v["name"],
            "taluk":    v["taluk"],
            "district": v["district"],
            "state":    v["state"],
            "lng":      v["lng"],
            "lat":      v["lat"],
            "livestock": v["livestock"],
            "vax":      v["vax"],
        })
        n += result.rowcount
    db.commit()
    print(f"    → {n} new rows (0 = already seeded)")


def seed_animals(db):
    print("  Seeding animals…")
    n = 0
    for a in ANIMALS:
        result = db.execute(text("""
            INSERT INTO animals (tag_id, species, breed, age_years)
            VALUES (:tag_id, :species, :breed, :age)
            ON CONFLICT (tag_id) DO NOTHING
        """), {"tag_id": a["tag_id"], "species": a["species"], "breed": a["breed"], "age": a["age"]})
        n += result.rowcount
    db.commit()
    print(f"    → {n} new rows")


def seed_reports(db):
    print("  Seeding reports…")
    n = 0
    for r in REPORTS:
        ts = ago(hours=r["hours_ago"])
        result = db.execute(text("""
            INSERT INTO reports (
                id, idempotency_key, tag_id, animal_id,
                species, breed, village, taluk, district, state,
                geom, syndrome, symptoms, mortality, affected_animals,
                reported_by, status, risk_factors, notes,
                created_at_client, received_at, updated_at
            ) VALUES (
                :id, :idem_key, :tag_id, :animal_id,
                :species, :breed, :village, :taluk, :district, :state,
                ST_SetSRID(ST_MakePoint(:lng, :lat), 4326),
                :syndrome, :symptoms::jsonb, :mortality, :affected,
                :reported_by, :status, :risk_factors::jsonb, :notes,
                :ts, :ts, :ts
            )
            ON CONFLICT (idempotency_key) DO NOTHING
        """), {
            "id":           uid(),
            "idem_key":     r["idem_key"],
            "tag_id":       r["tag_id"],
            "animal_id":    r["animal_id"],
            "species":      r["species"],
            "breed":        r["breed"],
            "village":      r["village"],
            "taluk":        r["taluk"],
            "district":     r["district"],
            "state":        "Maharashtra",
            "lng":          r["lng"],
            "lat":          r["lat"],
            "syndrome":     r["syndrome"],
            "symptoms":     json.dumps(r["symptoms"]),
            "mortality":    r["mortality"],
            "affected":     r["affected"],
            "reported_by":  r["reported_by"],
            "status":       r["status"],
            "risk_factors": json.dumps(r["risk_factors"]),
            "notes":        r["notes"],
            "ts":           ts,
        })
        n += result.rowcount
    db.commit()
    print(f"    → {n} new rows")


def seed_risk_assessments(db):
    """Persist WLC risk for every seeded report that has risk_factors."""
    print("  Seeding risk_assessments…")
    rows = db.execute(text(
        "SELECT id, risk_factors FROM reports WHERE risk_factors IS NOT NULL"
    )).fetchall()
    n = 0
    for row in rows:
        rf = row.risk_factors
        if not rf or len(rf) < 4:
            continue
        from risk_engine import calculate_risk
        risk = calculate_risk(**rf)
        result = db.execute(text("""
            INSERT INTO risk_assessments (id, report_id, crs, tier, factors, computed_at)
            VALUES (:id, :report_id::uuid, :crs, :tier, :factors::jsonb, now())
            ON CONFLICT (report_id) DO NOTHING
        """), {
            "id":        uid(),
            "report_id": str(row.id),
            "crs":       risk["score"],
            "tier":      risk["level"],
            "factors":   json.dumps(rf),
        })
        n += result.rowcount
    db.commit()
    print(f"    → {n} new rows")


def reset_all(db):
    print("  Wiping all data (cascade order)…")
    for table in [
        "notifications", "alerts", "containment_zones",
        "lab_referrals", "risk_assessments",
        "reports", "vaccinations", "animals", "villages",
    ]:
        db.execute(text(f"DELETE FROM {table}"))
    db.commit()
    print("  Wiped.")


def run(reset: bool = False):
    db = SessionLocal()
    try:
        if reset:
            reset_all(db)

        count = db.execute(text("SELECT count(*) FROM villages")).scalar()
        if count > 0 and not reset:
            print(f"Database already seeded ({count} villages). Use --reset to re-seed.")
            return

        print("Seeding Pashu Sentinel demo database…")
        seed_villages(db)
        seed_animals(db)
        seed_reports(db)
        seed_risk_assessments(db)
        print("Done. Database is ready.")
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Pashu Sentinel demo seeder")
    parser.add_argument("--reset", action="store_true", help="Wipe all data before seeding")
    args = parser.parse_args()
    run(reset=args.reset)
