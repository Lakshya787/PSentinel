"""
app/core/config.py — Application settings via pydantic-settings.

All values are read from environment variables (backend/.env).
Provides a single `settings` singleton imported throughout the app.
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env once at import time (no-op when vars already set by shell/Docker)
load_dotenv(Path(__file__).resolve().parents[3] / ".env")


class Settings:
    """Centralised application configuration.

    Attributes are read directly from environment variables with sane defaults
    for local development.  In production, all secrets must be injected via the
    shell environment or a secrets manager — never committed to VCS.
    """

    # ── FastAPI metadata ──────────────────────────────────────────────────────
    APP_TITLE:   str = "Pashu Sentinel API"
    APP_VERSION: str = "2.0.0"
    APP_DESCRIPTION: str = (
        "Smart livestock disease early-warning platform.\n\n"
        "**Database**: PostgreSQL + PostGIS (real spatial queries).\n"
        "**Intelligence Engine** (ref.md §10):\n"
        "- Tier 1: Isolation Forest case-level triage\n"
        "- Tier 2: EWMA + Noufaily-Farrington temporal aberration\n"
        "- Tier 3: ST_ClusterDBSCAN spatio-temporal clustering (PostGIS)"
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
    DB_HOST: str  = os.getenv("DB_HOST", "localhost")
    DB_PORT: str  = os.getenv("DB_PORT", "5433")
    DB_NAME: str  = os.getenv("DB_NAME", "pashu_sentinel")
    DB_USER: str  = os.getenv("DB_USER", "pashu")
    DB_PASS: str  = os.getenv("DB_PASS", "")

    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development").lower()
    DB_ECHO: bool    = os.getenv("DB_ECHO", "0") == "1"

    @property
    def resolved_database_url(self) -> str:
        """Return the full psycopg3 database URL, assembled from parts if needed."""
        url = self.DATABASE_URL
        if not url and self.DB_PASS:
            url = (
                f"postgresql+psycopg://{self.DB_USER}:{self.DB_PASS}"
                f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
            )
        if not url:
            raise RuntimeError(
                "DATABASE_URL not found.\n"
                "  Option A — set DATABASE_URL in backend/.env\n"
                "  Option B — set DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASS\n"
                "  See backend/.env.example for examples."
            )
        # Normalise bare postgresql:// → postgresql+psycopg://
        if url.startswith("postgresql://"):
            url = "postgresql+psycopg" + url[len("postgresql"):]
        return url

    @property
    def pool_size(self) -> int:
        return 10 if self.ENVIRONMENT == "production" else 5

    @property
    def max_overflow(self) -> int:
        return 20 if self.ENVIRONMENT == "production" else 10


# ─── Singleton ────────────────────────────────────────────────────────────────
settings = Settings()
