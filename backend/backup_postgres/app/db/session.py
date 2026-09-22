"""
app/db/session.py — SQLAlchemy engine, session factory, Base, and FastAPI dependency.

Replaces the top-level db.py.  All other modules should import from here:
    from app.db.session import Base, get_db, engine
"""
from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings

# ─── Engine ───────────────────────────────────────────────────────────────────
engine = create_engine(
    settings.resolved_database_url,
    pool_pre_ping=True,       # silently reconnects stale pool connections
    pool_size=settings.pool_size,
    max_overflow=settings.max_overflow,
    echo=settings.DB_ECHO,
)

# ─── Session factory ──────────────────────────────────────────────────────────
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ─── Declarative base ─────────────────────────────────────────────────────────
class Base(DeclarativeBase):
    pass


# ─── FastAPI dependency ───────────────────────────────────────────────────────
def get_db():
    """Yield a scoped SQLAlchemy Session; always closed on request exit."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
