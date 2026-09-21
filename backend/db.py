"""
db.py — SQLAlchemy 2.0 engine, session factory, Base, and FastAPI dependency.

Connection: Supabase session pooler (port 5432, psycopg v3).
  pool_pre_ping=True reconnects stale connections silently.
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# ─── Load .env (safe: no-op if already in environment) ───────────────────────
load_dotenv(Path(__file__).parent / ".env")

_DATABASE_URL: str | None = os.getenv("DATABASE_URL")
if not _DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL not found in backend/.env — "
        "see backend/.env.example for the required format "
        "(postgresql+psycopg://postgres.<project>:<password>@<host>:5432/postgres)"
    )

# ─── Engine ───────────────────────────────────────────────────────────────────
# pool_pre_ping: issues a lightweight SELECT 1 before handing out a connection
# from the pool, recovering from idle-connection drops on Supabase's side.
engine = create_engine(
    _DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    echo=False,      # set True to log every SQL statement
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
