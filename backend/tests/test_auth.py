"""
tests/test_auth.py — Auth endpoint tests.

Covers:
  POST /auth/register  — success, duplicate phone, invalid role, short password
  POST /auth/login     — success, wrong password, unknown user
  GET  /auth/me        — success, missing token, invalid token
  Role-based access    — FARMER blocked on VET/DVO-only route
"""
from __future__ import annotations

import pytest


# ── Helpers ───────────────────────────────────────────────────────────────────

FARMER_PAYLOAD = {
    "name": "Ravi Kumar",
    "phone": "+919876543210",
    "password": "farmpass1",
    "role": "FARMER",
}

VET_PAYLOAD = {
    "name": "Dr. Meera",
    "phone": "+919999900001",
    "password": "vetpass1",
    "role": "VET",
}


def _register(client, payload=None):
    return client.post("/auth/register", json=payload or FARMER_PAYLOAD)


def _login(client, phone, password):
    return client.post("/auth/login", json={"phone": phone, "password": password})


def _token(client, payload=None):
    r = _register(client, payload)
    assert r.status_code == 201, r.json()
    return r.json()["access_token"]


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ── Register tests ────────────────────────────────────────────────────────────

class TestRegister:

    def test_register_success(self, client):
        r = _register(client)
        assert r.status_code == 201
        body = r.json()
        assert "access_token" in body
        assert body["token_type"] == "bearer"
        assert body["user"]["role"] == "FARMER"
        assert "password" not in body["user"]
        assert "password_hash" not in body["user"]

    def test_register_returns_user_fields(self, client):
        r = _register(client)
        user = r.json()["user"]
        for key in ("id", "name", "phone", "role", "created_at"):
            assert key in user, f"Missing field: {key}"

    def test_register_duplicate_phone_returns_409(self, client):
        _register(client)
        r2 = _register(client)  # same phone
        assert r2.status_code == 409

    def test_register_invalid_role_returns_422(self, client):
        payload = {**FARMER_PAYLOAD, "phone": "+910000000001", "role": "ADMIN"}
        r = client.post("/auth/register", json=payload)
        assert r.status_code == 422

    def test_register_short_password_returns_422(self, client):
        payload = {**FARMER_PAYLOAD, "phone": "+910000000002", "password": "abc"}
        r = client.post("/auth/register", json=payload)
        assert r.status_code == 422

    def test_register_invalid_phone_returns_422(self, client):
        payload = {**FARMER_PAYLOAD, "phone": "123"}
        r = client.post("/auth/register", json=payload)
        assert r.status_code == 422

    def test_register_default_role_is_farmer(self, client):
        payload = {"name": "Default", "phone": "+910000000099", "password": "pass1234"}
        r = client.post("/auth/register", json=payload)
        assert r.status_code == 201
        assert r.json()["user"]["role"] == "FARMER"


# ── Login tests ───────────────────────────────────────────────────────────────

class TestLogin:

    def test_login_success(self, client):
        _register(client)
        r = _login(client, FARMER_PAYLOAD["phone"], FARMER_PAYLOAD["password"])
        assert r.status_code == 200
        body = r.json()
        assert "access_token" in body
        assert body["user"]["phone"] == FARMER_PAYLOAD["phone"]

    def test_login_wrong_password(self, client):
        _register(client)
        r = _login(client, FARMER_PAYLOAD["phone"], "wrongpassword")
        assert r.status_code == 401

    def test_login_unknown_user(self, client):
        r = _login(client, "+919000000001", "anypassword")
        assert r.status_code == 401

    def test_login_phone_normalised(self, client):
        """Phone with spaces/dashes should still log in correctly."""
        payload = {**FARMER_PAYLOAD, "phone": "+91 98765 43210"}
        r = _register(client, payload)
        assert r.status_code in (201, 409)  # might already exist from another test
        # Try logging in with dashes
        r2 = _login(client, "+91-98765-43210", FARMER_PAYLOAD["password"])
        # If the register succeeded we should get 200
        if r.status_code == 201:
            assert r2.status_code == 200


# ── /auth/me tests ────────────────────────────────────────────────────────────

class TestMe:

    def test_me_success(self, client):
        token = _token(client)
        r = client.get("/auth/me", headers=_auth_headers(token))
        assert r.status_code == 200
        user = r.json()["user"]
        assert user["name"] == FARMER_PAYLOAD["name"]

    def test_me_no_token_returns_403(self, client):
        r = client.get("/auth/me")
        # FastAPI HTTPBearer returns 403 when no credentials present
        assert r.status_code in (401, 403)

    def test_me_invalid_token_returns_401(self, client):
        r = client.get("/auth/me", headers={"Authorization": "Bearer invalidtoken"})
        assert r.status_code == 401

    def test_me_tampered_token_returns_401(self, client):
        token = _token(client)
        bad_token = token[:-5] + "XXXXX"
        r = client.get("/auth/me", headers=_auth_headers(bad_token))
        assert r.status_code == 401


# ── Role-based access tests ───────────────────────────────────────────────────

class TestRoleAccess:

    def test_farmer_cannot_do_case_action(self, client):
        """POST /cases/{id}/action requires VET or DVO — FARMER gets 403."""
        farmer_token = _token(client, FARMER_PAYLOAD)
        r = client.post(
            "/cases/FAKE-CASE-ID/action",
            json={"action": "ADVANCE_STATUS"},
            headers=_auth_headers(farmer_token),
        )
        # 403 (role denied) or 404 (case not found after role check)
        # Depending on route order; 404 means auth passed but case missing.
        assert r.status_code == 403

    def test_vet_can_attempt_case_action(self, client):
        """VET passes the role guard (even if the case doesn't exist → 404)."""
        vet_token = _token(client, VET_PAYLOAD)
        r = client.post(
            "/cases/FAKE-CASE-ID/action",
            json={"action": "ADVANCE_STATUS"},
            headers=_auth_headers(vet_token),
        )
        # Role guard passes, case 404 is expected
        assert r.status_code == 404

    def test_unauthenticated_cannot_submit_report(self, client):
        """POST /reports requires auth — no token → 401/403."""
        r = client.post("/reports", json={
            "species": "Cattle",
            "village": "Khandala",
            "taluk": "Junnar",
            "district": "Pune",
            "lat": 18.77,
            "lng": 73.88,
            "symptoms": ["fever"],
            "reported_by": "anonymous",
        })
        assert r.status_code in (401, 403)
