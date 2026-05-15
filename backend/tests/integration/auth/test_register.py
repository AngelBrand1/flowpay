from fastapi.testclient import TestClient


def test_register_returns_201_with_user_and_wallet(client: TestClient):
    response = client.post(
        "/auth/register",
        json={"username": "alice", "password": "password123"},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["user"]["username"] == "alice"
    assert data["user"]["id"].startswith("usr_")
    assert data["wallet"]["id"].startswith("wal_")
    assert data["wallet"]["currency"] == "COP"
    assert data["wallet"]["balance"] == 50_000


def test_stored_password_hash_is_not_plain_text(client: TestClient, db):
    """Test that the stored password hash is not the submitted password."""
    client.post(
        "/auth/register",
        json={"username": "alice", "password": "password123"},
    )

    # Query the database to check the password hash
    from flowpay.auth.adapters.credentials_orm import AuthCredentials

    credentials = db.query(AuthCredentials).first()
    assert credentials is not None
    assert credentials.password_hash != "password123"


def test_duplicate_register_returns_409(client: TestClient):
    """Test that duplicate register returns 409 username_already_exists."""
    # Register first user
    client.post(
        "/auth/register",
        json={"username": "alice", "password": "password123"},
    )

    # Try to register with the same username
    response = client.post(
        "/auth/register",
        json={"username": "alice", "password": "password456"},
    )

    assert response.status_code == 409
    data = response.json()
    assert data["error"]["code"] == "username_already_exists"


def test_missing_register_fields_returns_400(client: TestClient):
    """Test that missing register fields return 400 invalid_request."""
    # Missing password
    response = client.post(
        "/auth/register",
        json={"username": "alice"},
    )

    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == "invalid_request"


def test_request_transaction_commits_on_success(client: TestClient, db):
    """Test that the request transaction commits on success."""
    response = client.post(
        "/auth/register",
        json={"username": "alice", "password": "password123"},
    )

    assert response.status_code == 201

    # Check that the user was persisted
    from flowpay.users.adapters.user_orm import User

    user = db.query(User).filter(User.username == "alice").first()
    assert user is not None


def test_register_creates_wallet_persisted_in_db(client: TestClient, db):
    client.post(
        "/auth/register",
        json={"username": "alice", "password": "password123"},
    )

    from flowpay.users.adapters.user_orm import User
    from flowpay.wallets.adapters.wallet_orm import Wallet

    user = db.query(User).filter(User.username == "alice").first()
    wallet = db.query(Wallet).filter(Wallet.user_id == user.id).first()
    assert wallet is not None
    assert wallet.currency == "COP"


def test_register_records_welcome_bonus_in_ledger(client: TestClient, db):
    client.post(
        "/auth/register",
        json={"username": "alice", "password": "password123"},
    )

    from flowpay.ledger.adapters.ledger_orm import LedgerTransaction
    from flowpay.users.adapters.user_orm import User
    from flowpay.wallets.adapters.wallet_orm import Wallet

    user = db.query(User).filter(User.username == "alice").first()
    wallet = db.query(Wallet).filter(Wallet.user_id == user.id).first()
    txn = db.query(LedgerTransaction).filter(LedgerTransaction.wallet_id == wallet.id).first()

    assert txn is not None
    assert txn.type == "credit"
    assert txn.source == "welcome_bonus"
    assert txn.amount == 50_000
