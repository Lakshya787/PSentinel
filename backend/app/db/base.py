"""
app/db/base.py — Base declarative and metadata registry for Alembic / ORM imports.
"""
from app.db.session import Base  # noqa
import app.models  # noqa: F401 — ensure all models are registered on Base.metadata
