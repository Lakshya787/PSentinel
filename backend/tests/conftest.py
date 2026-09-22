"""
tests/conftest.py — pytest fixtures for the Pashu Sentinel test suite.

Uses an in-memory SQLite DB so no real Postgres connection is needed for unit tests.
For integration tests against the real DB, set TEST_DATABASE_URL in .env.
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.session import Base, get_db
from app.main import app

# ─── In-memory SQLite engine for tests ───────────────────────────────────────
# We use StaticPool so the same connection is reused across requests (in-memory DBs
# disappear when the connection closes).
TEST_DATABASE_URL = "sqlite://"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def create_tables():
    """Create all ORM tables once for the test session."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db_session():
    """Provide a fresh transaction-per-test that rolls back after each test."""
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture()
def client(db_session):
    """Provide a TestClient that uses the test DB session."""
    def _override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c
    app.dependency_overrides.clear()
