"""
app/db/session.py — SQLAlchemy engine, session factory, Base, and FastAPI dependency.

PostgreSQL / Supabase edition:
  - Uses psycopg3 driver (psycopg[binary]) via DATABASE_URL = postgresql+psycopg://...
  - Connection pool: QueuePool (default) in production, NullPool for Alembic migrations.
  - Tables are managed by Alembic migrations (run: alembic upgrade head).

All other modules should import from here:
    from app.db.session import Base, get_db, engine
"""
from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings

# ─── Engine ───────────────────────────────────────────────────────────────────
_url = settings.resolved_database_url

# In production, expand the pool; keep it lean in development.
_pool_kwargs = (
    {"pool_size": 10, "max_overflow": 20, "pool_pre_ping": True}
    if settings.ENVIRONMENT == "production"
    else {"pool_pre_ping": True}
)

engine = create_engine(
    _url,
    echo=settings.DB_ECHO,
    **_pool_kwargs,
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
