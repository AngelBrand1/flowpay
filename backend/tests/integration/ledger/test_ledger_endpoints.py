import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from flowpay.ledger.adapters.ledger_repository import SQLAlchemyLedgerRepository
from flowpay.ledger.application.ledger_service import LedgerService
from flowpay.wallets.adapters.wallet_repository import SQLAlchemyWalletRepository
from flowpay.wallets.application.wallet_service import WalletService


def _register_and_login(client: TestClient, username: str, password: str = "password123") -> str:
    """Register a user and return a JWT token."""
    client.post("/auth/register", json={"username": username, "password": password})
    resp = client.post("/auth/login", json={"username": username, "password": password})
    return resp.json()["access_token"]


def _create_wallet_for_user(db: Session, user_id: str) -> str:
    """Create a wallet for a user and return the wallet ID."""
    wallet_service = WalletService(SQLAlchemyWalletRepository(db))
    wallet = wallet_service.create_wallet(user_id)
    return wallet.id


def _credit_wallet(db: Session, wallet_id: str, amount: int, source: str = "welcome_bonus", op_id=None):
    """Directly add a credit entry to a wallet."""
    repo = SQLAlchemyLedgerRepository(db)
    repo.create_entry(
        transaction_id=f"txn_test_{wallet_id}_{amount}",
        wallet_id=wallet_id,
        type="credit",
        amount=amount,
        source=source,
        operation_id=op_id,
    )


def test_get_wallet_returns_200_with_balance(client: TestClient, db: Session):
    token = _register_and_login(client, "alice")

    from flowpay.users.adapters.user_orm import User
    user = db.query(User).filter(User.username == "alice").first()
    wallet_id = _create_wallet_for_user(db, user.id)
    _credit_wallet(db, wallet_id, 50_000)
    db.flush()

    resp = client.get("/wallet", headers={"Authorization": f"Bearer {token}"})

    assert resp.status_code == 200
    data = resp.json()
    assert "wallet" in data
    assert data["wallet"]["id"] == wallet_id
    assert data["wallet"]["balance"] == 50_000
    assert data["wallet"]["currency"] == "COP"


def test_get_wallet_requires_authentication(client: TestClient):
    resp = client.get("/wallet")
    assert resp.status_code == 401


def test_get_wallet_not_found_returns_404(client: TestClient, db: Session):
    token = _register_and_login(client, "bob")

    resp = client.get("/wallet", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "wallet_not_found"


def test_get_wallet_transactions_returns_history(client: TestClient, db: Session):
    token = _register_and_login(client, "carol")

    from flowpay.users.adapters.user_orm import User
    user = db.query(User).filter(User.username == "carol").first()
    wallet_id = _create_wallet_for_user(db, user.id)

    ledger_service = LedgerService(SQLAlchemyLedgerRepository(db))
    ledger_service.record_welcome_bonus(wallet_id, amount=50_000)

    from flowpay.users.adapters.user_repository import SQLAlchemyUserRepository
    from flowpay.users.application.user_service import UserService
    other_user = UserService(SQLAlchemyUserRepository(db)).create_user("carol_other")
    other_wallet_id = _create_wallet_for_user(db, other_user.id)
    for i in range(4):
        ledger_service.record_transfer_entries(
            operation_id=f"op_{i:03d}",
            source_wallet_id=wallet_id,
            destination_wallet_id=other_wallet_id,
            amount=1_000,
            source="manual_transfer",
        )
    db.flush()

    resp = client.get("/wallet/transactions", headers={"Authorization": f"Bearer {token}"})

    assert resp.status_code == 200
    data = resp.json()
    assert len(data["transactions"]) == 5


def test_get_wallet_transactions_respects_limit(client: TestClient, db: Session):
    token = _register_and_login(client, "dave")

    from flowpay.users.adapters.user_orm import User
    user = db.query(User).filter(User.username == "dave").first()
    wallet_id = _create_wallet_for_user(db, user.id)

    from flowpay.users.adapters.user_repository import SQLAlchemyUserRepository
    from flowpay.users.application.user_service import UserService
    other_user = UserService(SQLAlchemyUserRepository(db)).create_user("dave_other")
    other_wallet_id = _create_wallet_for_user(db, other_user.id)

    ledger_service = LedgerService(SQLAlchemyLedgerRepository(db))
    for i in range(20):
        ledger_service.record_transfer_entries(
            operation_id=f"op_{i:03d}",
            source_wallet_id=other_wallet_id,
            destination_wallet_id=wallet_id,
            amount=1_000,
            source="manual_transfer",
        )
    db.flush()

    resp = client.get("/wallet/transactions?limit=10", headers={"Authorization": f"Bearer {token}"})

    assert resp.status_code == 200
    data = resp.json()
    assert len(data["transactions"]) == 10
    assert data["next_cursor"] == "10"


def test_get_wallet_transactions_accepts_cursor(client: TestClient, db: Session):
    token = _register_and_login(client, "eve")

    from flowpay.users.adapters.user_orm import User
    user = db.query(User).filter(User.username == "eve").first()
    wallet_id = _create_wallet_for_user(db, user.id)

    from flowpay.users.adapters.user_repository import SQLAlchemyUserRepository
    from flowpay.users.application.user_service import UserService
    other_user = UserService(SQLAlchemyUserRepository(db)).create_user("eve_other")
    other_wallet_id = _create_wallet_for_user(db, other_user.id)

    ledger_service = LedgerService(SQLAlchemyLedgerRepository(db))
    for i in range(15):
        ledger_service.record_transfer_entries(
            operation_id=f"op_{i:03d}",
            source_wallet_id=other_wallet_id,
            destination_wallet_id=wallet_id,
            amount=1_000,
            source="manual_transfer",
        )
    db.flush()

    resp1 = client.get("/wallet/transactions?limit=10", headers={"Authorization": f"Bearer {token}"})
    cursor = resp1.json()["next_cursor"]

    resp2 = client.get(f"/wallet/transactions?limit=10&cursor={cursor}", headers={"Authorization": f"Bearer {token}"})

    assert resp2.status_code == 200
    data2 = resp2.json()
    page1_ids = {t["id"] for t in resp1.json()["transactions"]}
    page2_ids = {t["id"] for t in data2["transactions"]}
    assert page1_ids.isdisjoint(page2_ids)
    assert len(data2["transactions"]) == 5
    assert data2["next_cursor"] is None


def test_get_wallet_transactions_rejects_invalid_cursor(client: TestClient, db: Session):
    token = _register_and_login(client, "frank")

    from flowpay.users.adapters.user_orm import User
    user = db.query(User).filter(User.username == "frank").first()
    _create_wallet_for_user(db, user.id)
    db.flush()

    resp = client.get("/wallet/transactions?cursor=invalid", headers={"Authorization": f"Bearer {token}"})

    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "invalid_cursor"
