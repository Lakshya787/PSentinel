"""0001_initial_schema — All 9 tables (PostgreSQL / Supabase edition).

This migration creates the complete schema matching the current ORM models:
  - String(36) UUIDs (not PG UUID type) to match ORM primary keys
  - lat/lng Float columns instead of PostGIS geometry
  - JSONB columns with correct sa.text() server_defaults
  - PostGIS extension created (pre-installed on Supabase — safe no-op)
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostGIS is pre-installed on Supabase — this is a safe no-op there.
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    # ── villages ──────────────────────────────────────────────────────────────
    op.create_table(
        "villages",
        sa.Column("id",               sa.String(36),   primary_key=True),
        sa.Column("name",             sa.String(120),  nullable=False),
        sa.Column("taluk",            sa.String(120),  nullable=False),
        sa.Column("district",         sa.String(120),  nullable=False),
        sa.Column("state",            sa.String(120),  nullable=False, server_default="Maharashtra"),
        sa.Column("lat",              sa.Float(),      nullable=True),
        sa.Column("lng",              sa.Float(),      nullable=True),
        sa.Column("livestock_count",  sa.Integer(),    server_default="0"),
        sa.Column("fmd_vax_coverage", sa.Numeric(4, 3), server_default="0.0"),
    )

    # ── animals ───────────────────────────────────────────────────────────────
    op.create_table(
        "animals",
        sa.Column("tag_id",     sa.String(40),  primary_key=True),
        sa.Column("species",    sa.String(40),  nullable=False),
        sa.Column("breed",      sa.String(80)),
        sa.Column("age_years",  sa.Float()),
        sa.Column("owner_name", sa.String(120)),
        sa.Column("village_id", sa.String(36),
                  sa.ForeignKey("villages.id", ondelete="SET NULL")),
    )

    # ── vaccinations ──────────────────────────────────────────────────────────
    op.create_table(
        "vaccinations",
        sa.Column("id",            sa.String(36),  primary_key=True),
        sa.Column("animal_id",     sa.String(40),
                  sa.ForeignKey("animals.tag_id", ondelete="CASCADE"), nullable=False),
        sa.Column("disease",       sa.String(80),  nullable=False),
        sa.Column("vaccinated_on", sa.DateTime(timezone=True)),
    )

    # ── reports ───────────────────────────────────────────────────────────────
    op.create_table(
        "reports",
        sa.Column("id",               sa.String(36),  primary_key=True),
        sa.Column("idempotency_key",  sa.String(64),  nullable=False),
        sa.Column("tag_id",           sa.String(40)),
        sa.Column("animal_id",        sa.String(40),
                  sa.ForeignKey("animals.tag_id", ondelete="SET NULL")),
        sa.Column("village_id",       sa.String(36),
                  sa.ForeignKey("villages.id", ondelete="SET NULL")),
        # denormalised
        sa.Column("species",          sa.String(40)),
        sa.Column("breed",            sa.String(80)),
        sa.Column("age_years",        sa.Float()),
        sa.Column("village",          sa.String(120)),
        sa.Column("taluk",            sa.String(120)),
        sa.Column("district",         sa.String(120)),
        sa.Column("state",            sa.String(120),  server_default="Maharashtra"),
        # spatial (plain floats — Haversine computed in Python)
        sa.Column("lat",              sa.Float(),      nullable=True),
        sa.Column("lng",              sa.Float(),      nullable=True),
        # clinical
        sa.Column("syndrome",         sa.String(120)),
        sa.Column("symptoms",         JSONB(),         server_default=sa.text("'[]'::jsonb")),
        sa.Column("mortality",        sa.Integer(),    server_default="0"),
        sa.Column("affected_animals", sa.Integer(),    server_default="1"),
        sa.Column("photos",           JSONB(),         server_default=sa.text("'[]'::jsonb")),
        # workflow
        sa.Column("reported_by",      sa.String(120)),
        sa.Column("assigned_vet",     sa.String(80)),
        sa.Column("status",           sa.String(40),   server_default="REPORTED"),
        sa.Column("risk_factors",     JSONB()),
        sa.Column("notes",            sa.Text(),       server_default=""),
        sa.Column("tier1_triage",     JSONB()),
        # timestamps
        sa.Column("created_at_client", sa.DateTime(timezone=True)),
        sa.Column("received_at",       sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at",        sa.DateTime(timezone=True), server_default=sa.text("now()")),
        # constraints
        sa.UniqueConstraint("idempotency_key", name="uq_reports_idempotency_key"),
    )
    op.create_index("ix_reports_syndrome_received", "reports", ["syndrome", "received_at"])

    # ── risk_assessments ──────────────────────────────────────────────────────
    op.create_table(
        "risk_assessments",
        sa.Column("id",          sa.String(36), primary_key=True),
        sa.Column("report_id",   sa.String(36),
                  sa.ForeignKey("reports.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("crs",         sa.Numeric(5, 2)),
        sa.Column("tier",        sa.String(20)),
        sa.Column("factors",     JSONB()),
        sa.Column("computed_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # ── lab_referrals ─────────────────────────────────────────────────────────
    op.create_table(
        "lab_referrals",
        sa.Column("id",           sa.String(36), primary_key=True),
        sa.Column("report_id",    sa.String(36),
                  sa.ForeignKey("reports.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("sample_types", JSONB(), server_default=sa.text("'[]'::jsonb")),
        sa.Column("status",       sa.String(40), server_default="PENDING"),
        sa.Column("result",       JSONB()),
        sa.Column("result_at",    sa.DateTime(timezone=True)),
    )

    # ── containment_zones ─────────────────────────────────────────────────────
    op.create_table(
        "containment_zones",
        sa.Column("id",         sa.String(36), primary_key=True),
        sa.Column("report_id",  sa.String(36),
                  sa.ForeignKey("reports.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ring_km",    sa.Integer(), nullable=False),
        sa.Column("geojson",    JSONB(),      nullable=True),   # GeoJSON Polygon dict
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("report_id", "ring_km", name="uq_zone_report_ring"),
    )

    # ── alerts ────────────────────────────────────────────────────────────────
    op.create_table(
        "alerts",
        sa.Column("id",              sa.String(36), primary_key=True),
        sa.Column("zone_id",         sa.String(36),
                  sa.ForeignKey("containment_zones.id", ondelete="CASCADE"), nullable=False),
        sa.Column("language",        sa.String(20)),
        sa.Column("message",         sa.Text()),
        sa.Column("recipient_count", sa.Integer(), server_default="0"),
        sa.Column("sent_at",         sa.DateTime(timezone=True)),
    )

    # ── notifications ─────────────────────────────────────────────────────────
    op.create_table(
        "notifications",
        sa.Column("id",         sa.String(36), primary_key=True),
        sa.Column("type",       sa.String(40)),
        sa.Column("report_id",  sa.String(36),
                  sa.ForeignKey("reports.id", ondelete="CASCADE"), nullable=False),
        sa.Column("payload",    JSONB(), server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # ── Row Level Security ────────────────────────────────────────────────────
    # Blocks Supabase public REST API — harmless when using direct psycopg.
    for table in [
        "villages", "animals", "vaccinations", "reports",
        "risk_assessments", "lab_referrals",
        "containment_zones", "alerts", "notifications",
    ]:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    for table in [
        "notifications", "alerts", "containment_zones", "lab_referrals",
        "risk_assessments", "reports", "vaccinations", "animals", "villages",
    ]:
        op.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
