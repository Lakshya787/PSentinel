"""
alembic/env.py — Alembic migration environment.

Reads DATABASE_URL from backend/.env (via python-dotenv).
Imports models.Base.metadata so `alembic revision --autogenerate` works.
GeoAlchemy2 render functions are registered so geometry columns migrate correctly.
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

# Import all models so Base.metadata is fully populated
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from db import Base
import models  # registers all ORM classes on Base.metadata  # noqa: F401

# GeoAlchemy2: register custom render functions so autogenerate emits Geometry()
try:
    import geoalchemy2
    from geoalchemy2 import alembic_helpers
    geoalchemy2_helpers_available = True
except ImportError:
    geoalchemy2_helpers_available = False

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# Override sqlalchemy.url with DATABASE_URL from .env (never stored in alembic.ini)
DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL:
    # Normalise scheme only — bare postgresql:// → postgresql+psycopg://
    if DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = "postgresql+psycopg" + DATABASE_URL[len("postgresql"):]
    config.set_main_option("sqlalchemy.url", DATABASE_URL)


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_schemas=True,
        process_revision_directives=(
            alembic_helpers.writer if geoalchemy2_helpers_available else None
        ),
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_schemas=True,
            process_revision_directives=(
                alembic_helpers.writer if geoalchemy2_helpers_available else None
            ),
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
