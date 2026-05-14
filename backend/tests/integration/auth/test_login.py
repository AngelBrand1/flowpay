from fastapi.testclient import TestClient


def test_login_returns_token_with_3600_expires_in(client: TestClient):
    """Test that login returns token with expires_in = 3600."""
    # Register first
    client.post(
        "/auth/register",
        json={"username": "alice", "password": "password123"},
    )

    # Login
    response = client.post(
        "/auth/login",
        json={"username": "alice", "password": "password123"},
    )

    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["expires_in"] == 3600
    assert "user" in data


def test_wrong_password_returns_401(client: TestClient):
    """Test that wrong password returns 401 invalid_credentials."""
    # Register first
    client.post(
        "/auth/register",
        json={"username": "alice", "password": "password123"},
    )

    # Try to login with wrong password
    response = client.post(
        "/auth/login",
        json={"username": "alice", "password": "wrongpassword"},
    )

    assert response.status_code == 401
    data = response.json()
    assert data["error"]["code"] == "invalid_credentials"


def test_unknown_user_returns_401(client: TestClient):
    """Test that unknown user returns 401 invalid_credentials."""
    response = client.post(
        "/auth/login",
        json={"username": "nonexistent", "password": "password123"},
    )

    assert response.status_code == 401
    data = response.json()
    assert data["error"]["code"] == "invalid_credentials"
