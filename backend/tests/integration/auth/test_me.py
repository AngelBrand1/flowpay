from fastapi.testclient import TestClient


def test_get_me_returns_authenticated_user(client: TestClient):
    """Test that /auth/me returns the authenticated user for a valid token."""
    # Register and login
    client.post(
        "/auth/register",
        json={"username": "alice", "password": "password123"},
    )

    login_response = client.post(
        "/auth/login",
        json={"username": "alice", "password": "password123"},
    )

    token = login_response.json()["access_token"]

    # Call /auth/me with the token
    response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    data = response.json()
    assert "user" in data
    assert data["user"]["username"] == "alice"


def test_get_me_rejects_missing_token(client: TestClient):
    """Test that /auth/me rejects missing token with 401."""
    response = client.get("/auth/me")

    assert response.status_code == 401
    data = response.json()
    assert data["error"]["code"] == "unauthenticated"


def test_get_me_rejects_invalid_token(client: TestClient):
    """Test that /auth/me rejects invalid token with 401."""
    response = client.get(
        "/auth/me",
        headers={"Authorization": "Bearer invalid.token.here"},
    )

    assert response.status_code == 401
    data = response.json()
    assert data["error"]["code"] == "unauthenticated"


def test_get_me_rejects_expired_token(client: TestClient):
    """Test that /auth/me rejects expired token with 401."""
    from datetime import datetime, timedelta, timezone

    from jose import jwt

    from flowpay.auth.adapters.jwt_handler import TOKEN_ALGORITHM
    from flowpay.config import settings

    # Create an expired token
    now = datetime.now(timezone.utc)
    expired_time = int((now - timedelta(seconds=1)).timestamp())
    payload = {
        "sub": "usr_test123",
        "iat": int(now.timestamp()),
        "exp": expired_time,
    }
    expired_token = jwt.encode(payload, settings.auth_secret_key, algorithm=TOKEN_ALGORITHM)

    response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )

    assert response.status_code == 401
    data = response.json()
    assert data["error"]["code"] == "unauthenticated"
