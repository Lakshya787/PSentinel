"""0001_initial_schema — PostGIS extension + all 9 tables.

This migration:
  1. CREATE EXTENSION IF NOT EXISTS postgis  (requires superuser on Supabase;
     if it fails, run the command manually in the Supabase SQL editor first)
  2. Creates all 9 tables with correct GIST indices and RLS enabled.
"""
from __future__ import annotations

import sqlalchemy as sa
import geoalchemy2
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── PostGIS extension ─────────────────────────────────────────────────────
    # On Supabase shared instances PostGIS is pre-installed; this is a no-op.
    # On a fresh Postgres instance this requires superuser privilege.
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    # ── villages ──────────────────────────────────────────────────────────────
    op.create_table(
        "villages",
        sa.Column("id",               PG_UUID(as_uuid=False), primary_key=True),
        sa.Column("name",             sa.String(120),  nullable=False),
        sa.Column("taluk",            sa.String(120),  nullable=False),
        sa.Column("district",         sa.String(120),  nullable=False),
        sa.Column("state",            sa.String(120),  nullable=False, server_default="Maharashtra"),
        sa.Column("geom",             geoalchemy2.types.Geometry("POINT", srid=4326, nullable=True)),
        sa.Column("livestock_count",  sa.Integer(),    server_default="0"),
        sa.Column("fmd_vax_coverage", sa.Numeric(4, 3), server_default="0.0"),
    )
    op.create_index("ix_villages_geom", "villages", ["geom"], postgresql_using="gist")

    # ── animals ───────────────────────────────────────────────────────────────
    op.create_table(
        "animals",
        sa.Column("tag_id",     sa.String(40),  primary_key=True),
        sa.Column("species",    sa.String(40),  nullable=False),
        sa.Column("breed",      sa.String(80)),
        sa.Column("age_years",  sa.Float()),
        sa.Column("owner_name", sa.String(120)),
        sa.Column("village_id", PG_UUID(as_uuid=False),
                  sa.ForeignKey("villages.id", ondelete="SET NULL")),
    )

    # ── vaccinations ──────────────────────────────────────────────────────────
    op.create_table(
        "vaccinations",
        sa.Column("id",            PG_UUID(as_uuid=False), primary_key=True),
        sa.Column("animal_id",     sa.String(40),
                  sa.ForeignKey("animals.tag_id", ondelete="CASCADE"), nullable=False),
        sa.Column("disease",       sa.String(80), nullable=False),
        sa.Column("vaccinated_on", sa.DateTime(timezone=True)),
    )

    # ── reports ───────────────────────────────────────────────────────────────
    op.create_table(
        "reports",
        sa.Column("id",               PG_UUID(as_uuid=False), primary_key=True),
        sa.Column("idempotency_key",  sa.String(64),  nullable=False),
        sa.Column("tag_id",           sa.String(40)),
        sa.Column("animal_id",        sa.String(40),
                  sa.ForeignKey("animals.tag_id", ondelete="SET NULL")),
        sa.Column("village_id",       PG_UUID(as_uuid=False),
                  sa.ForeignKey("villages.id", ondelete="SET NULL")),
        # denormalised
        sa.Column("species",          sa.String(40)),
        sa.Column("breed",            sa.String(80)),
        sa.Column("age_years",        sa.Float()),
        sa.Column("village",          sa.String(120)),
        sa.Column("taluk",            sa.String(120)),
        sa.Column("district",         sa.String(120)),
        sa.Column("state",            sa.String(120), server_default="Maharashtra"),
        # spatial
        sa.Column("geom",             geoalchemy2.types.Geometry("POINT", srid=4326, nullable=True)),
        # clinical
        sa.Column("syndrome",         sa.String(120)),
        sa.Column("symptoms",         JSONB(),         server_default="'[]'"),
        sa.Column("mortality",        sa.Integer(),    server_default="0"),
        sa.Column("affected_animals", sa.Integer(),    server_default="1"),
        sa.Column("photos",           JSONB(),         server_default="'[]'"),
        # workflow
        sa.Column("reported_by",      sa.String(120)),
        sa.Column("assigned_vet",     sa.String(80)),
        sa.Column("status",           sa.String(40),  server_default="REPORTED"),
        sa.Column("risk_factors",     JSONB()),
        sa.Column("notes",            sa.Text(),      server_default=""),
        sa.Column("tier1_triage",     JSONB()),
        # timestamps
        sa.Column("created_at_client", sa.DateTime(timezone=True)),
        sa.Column("received_at",       sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at",        sa.DateTime(timezone=True), server_default=sa.text("now()")),
        # constraints
        sa.UniqueConstraint("idempotency_key", name="uq_reports_idempotency_key"),
    )
    op.create_index("ix_reports_geom",             "reports", ["geom"],
                    postgresql_using="gist")
    op.create_index("ix_reports_syndrome_received", "reports", ["syndrome", "received_at"])

    # ── risk_assessments ──────────────────────────────────────────────────────
    op.create_table(
        "risk_assessments",
        sa.Column("id",          PG_UUID(as_uuid=False), primary_key=True),
        sa.Column("report_id",   PG_UUID(as_uuid=False),
                  sa.ForeignKey("reports.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("crs",         sa.Numeric(5, 2)),
        sa.Column("tier",        sa.String(20)),
        sa.Column("factors",     JSONB()),
        sa.Column("computed_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # ── lab_referrals ─────────────────────────────────────────────────────────
    op.create_table(
        "lab_referrals",
        sa.Column("id",           PG_UUID(as_uuid=False), primary_key=True),
        sa.Column("report_id",    PG_UUID(as_uuid=False),
                  sa.ForeignKey("reports.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("sample_types", JSONB(), server_default="'[]'"),
        sa.Column("status",       sa.String(40), server_default="PENDING"),
        sa.Column("result",       JSONB()),
        sa.Column("result_at",    sa.DateTime(timezone=True)),
    )

    # ── containment_zones ─────────────────────────────────────────────────────
    op.create_table(
        "containment_zones",
        sa.Column("id",         PG_UUID(as_uuid=False), primary_key=True),
        sa.Column("report_id",  PG_UUID(as_uuid=False),
                  sa.ForeignKey("reports.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ring_km",    sa.Integer(), nullable=False),
        sa.Column("geom",       geoalchemy2.types.Geometry("POLYGON", srid=4326, nullable=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("report_id", "ring_km", name="uq_zone_report_ring"),
    )
    op.create_index("ix_containment_zones_geom", "containment_zones", ["geom"],
                    postgresql_using="gist")

    # ── alerts ────────────────────────────────────────────────────────────────
    op.create_table(
        "alerts",
        sa.Column("id",              PG_UUID(as_uuid=False), primary_key=True),
        sa.Column("zone_id",         PG_UUID(as_uuid=False),
                  sa.ForeignKey("containment_zones.id", ondelete="CASCADE"), nullable=False),
        sa.Column("language",        sa.String(20)),
        sa.Column("message",         sa.Text()),
        sa.Column("recipient_count", sa.Integer(), server_default="0"),
        sa.Column("sent_at",         sa.DateTime(timezone=True)),
    )

    # ── notifications ─────────────────────────────────────────────────────────
    op.create_table(
        "notifications",
        sa.Column("id",         PG_UUID(as_uuid=False), primary_key=True),
        sa.Column("type",       sa.String(40)),
        sa.Column("report_id",  PG_UUID(as_uuid=False),
                  sa.ForeignKey("reports.id", ondelete="CASCADE"), nullable=False),
        sa.Column("payload",    JSONB(), server_default="'{}'"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    # ── Row Level Security (no policies — blocks Supabase public REST API only) ──
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
