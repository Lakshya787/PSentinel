"""
app/core/config.py — Application settings via plain class + os.getenv.

PostgreSQL / Supabase edition:
  DATABASE_URL must be set to a psycopg3-compatible PostgreSQL URL, e.g.:
    postgresql+psycopg://postgres.PROJECTREF:PASSWORD@aws-X.pooler.supabase.com:5432/postgres
All values are read from environment variables (backend/.env).
Provides a single `settings` singleton imported throughout the app.
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env once at import time (no-op when vars already set by shell)
load_dotenv(Path(__file__).resolve().parents[2] / ".env")


class Settings:
    """Centralised application configuration.

    Attributes are read directly from environment variables with sane defaults
    for local development.
    """

    # ── FastAPI metadata ──────────────────────────────────────────────────────
    APP_TITLE:   str = "Pashu Sentinel API"
    APP_VERSION: str = "2.0.0"
    APP_DESCRIPTION: str = (
        "Smart livestock disease early-warning platform.\n\n"
        "**Database**: PostgreSQL + PostGIS (Supabase).\n"
        "**Intelligence Engine** (ref.md §10):\n"
        "- Tier 1: Isolation Forest case-level triage\n"
        "- Tier 2: EWMA + Noufaily-Farrington temporal aberration\n"
        "- Tier 3: DBSCAN spatio-temporal clustering (sklearn + Haversine)"
    )

    # ── CORS ─────────────────────────────────────────────────────────────────
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
    ]

    # ── JWT ───────────────────────────────────────────────────────────────────
    JWT_SECRET: str = os.getenv(
        "JWT_SECRET", "pashu-sentinel-dev-secret-change-in-production"
    )
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10080")  # 7 days
    )

    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str | None = os.getenv("DATABASE_URL")

    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development").lower()
    DB_ECHO: bool    = os.getenv("DB_ECHO", "0") == "1"

    @property
    def resolved_database_url(self) -> str:
        """Return the PostgreSQL database URL.

        Normalises bare `postgresql://` → `postgresql+psycopg://` so the
        psycopg3 driver is used in all environments.

        Raises:
            RuntimeError: if DATABASE_URL is not set.
        """
        url = self.DATABASE_URL
        if not url:
            raise RuntimeError(
                "DATABASE_URL is not set. "
                "Add it to backend/.env (copy from .env.example) or your "
                "hosting platform's environment variables.\n"
                "Example (Supabase session pooler):\n"
                "  DATABASE_URL=postgresql+psycopg://postgres.PROJECTREF:PASSWORD"
                "@aws-X-REGION.pooler.supabase.com:5432/postgres"
            )
        # Normalise: bare postgresql:// → postgresql+psycopg://
        if url.startswith("postgresql://"):
            url = "postgresql+psycopg" + url[len("postgresql"):]
        return url


# ─── Singleton ────────────────────────────────────────────────────────────────
settings = Settings()
