import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from flowpay.ledger.adapters.ledger_repository import SQLAlchemyLedgerRepository
from flowpay.ledger.application.ledger_service import LedgerService
from flowpay.wallets.adapters.wallet_repository import SQLAlchemyWalletRepository
from flowpay.wallets.application.wallet_service import WalletService


def _register_and_get(client: TestClient, username: str, password: str = "password123") -> tuple[str, str]:
    """Register a user and return (access_token, wallet_id)."""
    reg_resp = client.post("/auth/register", json={"username": username, "password": password})
    login_resp = client.post("/auth/login", json={"username": username, "password": password})
    return login_resp.json()["access_token"], reg_resp.json()["wallet"]["id"]


def _create_wallet_for_user(db: Session, user_id: str) -> str:
    """Create a wallet for a user and return the wallet ID."""
    wallet_service = WalletService(SQLAlchemyWalletRepository(db))
    wallet = wallet_service.create_wallet(user_id)
    return wallet.id


def test_get_wallet_returns_200_with_balance(client: TestClient, db: Session):
    token, wallet_id = _register_and_get(client, "alice")

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
    # Create user+credentials directly (no wallet) to test the 404 case.
    from flowpay.composition import build_auth_service

    build_auth_service(db).register("bob", "password123")
    db.flush()

    login_resp = client.post("/auth/login", json={"username": "bob", "password": "password123"})
    token = login_resp.json()["access_token"]

    resp = client.get("/wallet", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "wallet_not_found"


def test_get_wallet_transactions_returns_history(client: TestClient, db: Session):
    # Registration creates 1 welcome_bonus txn; 4 outgoing transfers = 5 total.
    token, wallet_id = _register_and_get(client, "carol")

    from flowpay.users.adapters.user_repository import SQLAlchemyUserRepository
    from flowpay.users.application.user_service import UserService

    other_user = UserService(SQLAlchemyUserRepository(db)).create_user("carol_other")
    other_wallet_id = _create_wallet_for_user(db, other_user.id)

    ledger_service = LedgerService(SQLAlchemyLedgerRepository(db))
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
    # 1 welcome_bonus + 20 incoming transfers = 21 total; limit=10 returns 10.
    token, wallet_id = _register_and_get(client, "dave")

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
    # 1 welcome_bonus + 14 incoming transfers = 15 total; page1=10, page2=5.
    token, wallet_id = _register_and_get(client, "eve")

    from flowpay.users.adapters.user_repository import SQLAlchemyUserRepository
    from flowpay.users.application.user_service import UserService

    other_user = UserService(SQLAlchemyUserRepository(db)).create_user("eve_other")
    other_wallet_id = _create_wallet_for_user(db, other_user.id)

    ledger_service = LedgerService(SQLAlchemyLedgerRepository(db))
    for i in range(14):
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
    token, _ = _register_and_get(client, "frank")

    resp = client.get("/wallet/transactions?cursor=invalid", headers={"Authorization": f"Bearer {token}"})

    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "invalid_cursor"
