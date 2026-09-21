"""
db.py — SQLAlchemy 2.0 engine, session factory, Base, and FastAPI dependency.

Connection resolution order (first match wins):
  1. DATABASE_URL          — full connection string in .env  (preferred)
  2. DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASS
                           — individual component vars (useful in k8s / CI)

Accepted URL schemes (both normalised to psycopg3):
  postgresql://...          →  postgresql+psycopg://...
  postgresql+psycopg://...  →  used as-is

Other env-vars:
  ENVIRONMENT  (default "development") — set to "production" to
               increase pool_size / max_overflow for prod load.
  DB_ECHO      (default "0")           — set to "1" to log all SQL.
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# ─── Load .env (no-op when vars are already injected by the shell / Docker) ───
load_dotenv(Path(__file__).parent / ".env")

# ── Resolve DATABASE_URL (prefer full URL, fall back to component vars) ───────
_DATABASE_URL: str | None = os.getenv("DATABASE_URL")

if not _DATABASE_URL:
    # Assemble from individual parts (useful in Docker Compose / k8s envs)
    _host = os.getenv("DB_HOST", "localhost")
    _port = os.getenv("DB_PORT", "5433")          # matches docker-compose.yml
    _name = os.getenv("DB_NAME", "pashu_sentinel")
    _user = os.getenv("DB_USER", "pashu")
    _pass = os.getenv("DB_PASS", "")
    if _pass:
        _DATABASE_URL = (
            f"postgresql+psycopg://{_user}:{_pass}@{_host}:{_port}/{_name}"
        )

if not _DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL not found.\n"
        "  Option A — set DATABASE_URL in backend/.env\n"
        "  Option B — set DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASS\n"
        "  See backend/.env.example for examples."
    )

# ── Normalise scheme: bare postgresql:// → postgresql+psycopg:// ──────────────
# psycopg3 requires the +psycopg dialect tag; psycopg2 is not installed.
if _DATABASE_URL.startswith("postgresql://"):
    _DATABASE_URL = "postgresql+psycopg" + _DATABASE_URL[len("postgresql"):]

# ── Engine tuning ─────────────────────────────────────────────────────────────
_ENV  = os.getenv("ENVIRONMENT", "development").lower()
_ECHO = os.getenv("DB_ECHO", "0") == "1"

# Local dev uses a small pool; production gets more headroom.
_POOL_SIZE   = 10 if _ENV == "production" else 5
_MAX_OVERFLOW = 20 if _ENV == "production" else 10

# ─── Engine ───────────────────────────────────────────────────────────────────
engine = create_engine(
    _DATABASE_URL,
    pool_pre_ping=True,   # silently reconnects stale pooler connections
    pool_size=_POOL_SIZE,
    max_overflow=_MAX_OVERFLOW,
    echo=_ECHO,
)

# ─── Session factory ──────────────────────────────────────────────────────────
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ─── Declarative base ─────────────────────────────────────────────────────────
class Base(DeclarativeBase):
    pass


# ─── FastAPI dependency ───────────────────────────────────────────────────────
def get_db():
    """Yield a scoped SQLAlchemy Session; always close on request exit."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
