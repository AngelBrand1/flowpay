import os
import threading

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

TEST_DATABASE_URL = os.environ.get(
    "DATABASE_URL_TEST",
    "postgresql+psycopg://flowpay:flowpay@localhost:5433/flowpay_test",
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _register(client: TestClient, username: str, password: str = "password123") -> dict:
    resp = client.post("/auth/register", json={"username": username, "password": password})
    assert resp.status_code == 201
    return resp.json()


def _login(client: TestClient, username: str, password: str = "password123") -> str:
    resp = client.post("/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200
    return resp.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _post_transfer(client, token, payload, key="key-001"):
    return client.post(
        "/transfers",
        json=payload,
        headers={**_auth(token), "Idempotency-Key": key},
    )


# ---------------------------------------------------------------------------
# Basic creation tests
# ---------------------------------------------------------------------------

def test_create_manual_transfer_returns_201(client: TestClient):
    alice_data = _register(client, "alice_t1")
    bob_data = _register(client, "bob_t1")
    alice_token = _login(client, "alice_t1")

    dest_wallet = bob_data["wallet"]["id"]
    resp = _post_transfer(client, alice_token, {"destination_wallet_id": dest_wallet, "amount": 10_000})

    assert resp.status_code == 201
    t = resp.json()["transfer"]
    assert t["id"].startswith("txop_")
    assert t["source_wallet_id"] == alice_data["wallet"]["id"]
    assert t["destination_wallet_id"] == dest_wallet
    assert t["amount"] == 10_000
    assert t["currency"] == "COP"
    assert t["origin"] == "manual_transfer"
    assert t["status"] == "completed"


def test_create_nfc_transfer_uses_nfc_origin(client: TestClient):
    _register(client, "alice_t2")
    bob_data = _register(client, "bob_t2")
    token = _login(client, "alice_t2")

    resp = _post_transfer(
        client, token,
        {"destination_wallet_id": bob_data["wallet"]["id"], "amount": 5_000, "origin": "nfc_transfer"},
    )
    assert resp.status_code == 201
    assert resp.json()["transfer"]["origin"] == "nfc_transfer"


def test_transfer_creates_exactly_one_debit_and_credit(client: TestClient, db):
    _register(client, "alice_t3")
    bob_data = _register(client, "bob_t3")
    token = _login(client, "alice_t3")
    _post_transfer(client, token, {"destination_wallet_id": bob_data["wallet"]["id"], "amount": 3_000})

    from flowpay.ledger.adapters.ledger_orm import LedgerTransaction

    debits = db.query(LedgerTransaction).filter(LedgerTransaction.type == "debit").all()
    credits = db.query(LedgerTransaction).filter(
        LedgerTransaction.type == "credit",
        LedgerTransaction.source != "welcome_bonus",
    ).all()
    assert len(debits) == 1
    assert len(credits) == 1


def test_debit_and_credit_share_operation_id_and_amount(client: TestClient, db):
    _register(client, "alice_t4")
    bob_data = _register(client, "bob_t4")
    token = _login(client, "alice_t4")
    _post_transfer(client, token, {"destination_wallet_id": bob_data["wallet"]["id"], "amount": 7_000})

    from flowpay.ledger.adapters.ledger_orm import LedgerTransaction

    debit = db.query(LedgerTransaction).filter(LedgerTransaction.type == "debit").first()
    credit = db.query(LedgerTransaction).filter(
        LedgerTransaction.type == "credit",
        LedgerTransaction.source != "welcome_bonus",
    ).first()
    assert debit.operation_id == credit.operation_id
    assert debit.amount == credit.amount == 7_000


def test_source_balance_decreases_and_destination_increases(client: TestClient, db):
    alice_data = _register(client, "alice_t5")
    bob_data = _register(client, "bob_t5")
    token = _login(client, "alice_t5")

    _post_transfer(client, token, {"destination_wallet_id": bob_data["wallet"]["id"], "amount": 10_000})

    from flowpay.composition import build_ledger_service

    svc = build_ledger_service(db)
    src_bal = svc.get_wallet_balance(alice_data["wallet"]["id"])
    dst_bal = svc.get_wallet_balance(bob_data["wallet"]["id"])

    assert src_bal.balance == 40_000  # 50k bonus - 10k
    assert dst_bal.balance == 60_000  # 50k bonus + 10k


# ---------------------------------------------------------------------------
# Validation errors
# ---------------------------------------------------------------------------

def test_missing_idempotency_key_returns_400(client: TestClient):
    _register(client, "alice_t6")
    bob_data = _register(client, "bob_t6")
    token = _login(client, "alice_t6")

    resp = client.post(
        "/transfers",
        json={"destination_wallet_id": bob_data["wallet"]["id"], "amount": 1_000},
        headers=_auth(token),
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "invalid_request"


def test_zero_amount_returns_400(client: TestClient):
    _register(client, "alice_t7")
    bob_data = _register(client, "bob_t7")
    token = _login(client, "alice_t7")

    resp = _post_transfer(client, token, {"destination_wallet_id": bob_data["wallet"]["id"], "amount": 0})
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "invalid_amount"


def test_negative_amount_returns_400(client: TestClient):
    _register(client, "alice_t8")
    bob_data = _register(client, "bob_t8")
    token = _login(client, "alice_t8")

    resp = _post_transfer(client, token, {"destination_wallet_id": bob_data["wallet"]["id"], "amount": -1})
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "invalid_amount"


def test_same_wallet_transfer_returns_400(client: TestClient):
    alice_data = _register(client, "alice_t9")
    token = _login(client, "alice_t9")

    resp = _post_transfer(client, token, {"destination_wallet_id": alice_data["wallet"]["id"], "amount": 1_000})
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "same_wallet_transfer"


def test_destination_wallet_not_found_returns_404(client: TestClient):
    _register(client, "alice_t10")
    token = _login(client, "alice_t10")

    resp = _post_transfer(client, token, {"destination_wallet_id": "wal_nonexistent", "amount": 1_000})
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "destination_wallet_not_found"


def test_insufficient_balance_returns_409_and_no_ledger_entries(client: TestClient, db):
    _register(client, "alice_t11")
    bob_data = _register(client, "bob_t11")
    token = _login(client, "alice_t11")

    resp = _post_transfer(
        client, token,
        {"destination_wallet_id": bob_data["wallet"]["id"], "amount": 100_000},
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "insufficient_balance"

    from flowpay.ledger.adapters.ledger_orm import LedgerTransaction

    debits = db.query(LedgerTransaction).filter(LedgerTransaction.type == "debit").all()
    assert len(debits) == 0


def test_unauthenticated_returns_401(client: TestClient):
    resp = client.post(
        "/transfers",
        json={"destination_wallet_id": "wal_x", "amount": 1_000},
        headers={"Idempotency-Key": "k"},
    )
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Idempotency tests
# ---------------------------------------------------------------------------

def test_same_key_same_payload_returns_original_response(client: TestClient):
    _register(client, "alice_t12")
    bob_data = _register(client, "bob_t12")
    token = _login(client, "alice_t12")

    payload = {"destination_wallet_id": bob_data["wallet"]["id"], "amount": 5_000}
    r1 = _post_transfer(client, token, payload, key="idem-001")
    r2 = _post_transfer(client, token, payload, key="idem-001")

    assert r1.status_code == 201
    assert r2.status_code == 201
    assert r1.json() == r2.json()


def test_same_key_same_payload_does_not_create_second_transfer(client: TestClient, db):
    _register(client, "alice_t13")
    bob_data = _register(client, "bob_t13")
    token = _login(client, "alice_t13")

    payload = {"destination_wallet_id": bob_data["wallet"]["id"], "amount": 5_000}
    _post_transfer(client, token, payload, key="idem-002")
    _post_transfer(client, token, payload, key="idem-002")

    from flowpay.transfers.adapters.orm import TransferOperation

    ops = db.query(TransferOperation).all()
    assert len(ops) == 1


def test_same_key_different_payload_returns_409(client: TestClient):
    _register(client, "alice_t14")
    bob_data = _register(client, "bob_t14")
    token = _login(client, "alice_t14")

    _post_transfer(client, token, {"destination_wallet_id": bob_data["wallet"]["id"], "amount": 5_000}, key="idem-003")
    r2 = _post_transfer(client, token, {"destination_wallet_id": bob_data["wallet"]["id"], "amount": 6_000}, key="idem-003")

    assert r2.status_code == 409
    assert r2.json()["error"]["code"] == "idempotency_key_conflict"


def test_idempotency_keys_are_scoped_by_user(client: TestClient):
    alice_data = _register(client, "alice_t15")
    bob_data = _register(client, "bob_t15")
    carol_data = _register(client, "carol_t15")
    alice_token = _login(client, "alice_t15")
    bob_token = _login(client, "bob_t15")

    payload_a = {"destination_wallet_id": carol_data["wallet"]["id"], "amount": 5_000}
    payload_b = {"destination_wallet_id": alice_data["wallet"]["id"], "amount": 5_000}

    r1 = _post_transfer(client, alice_token, payload_a, key="shared-key")
    r2 = _post_transfer(client, bob_token, payload_b, key="shared-key")

    assert r1.status_code == 201
    assert r2.status_code == 201
    # Different users, same key — each gets an independent transfer
    assert r1.json()["transfer"]["id"] != r2.json()["transfer"]["id"]


# ---------------------------------------------------------------------------
# GET /transfers/{id} access control
# ---------------------------------------------------------------------------

def test_source_participant_can_get_transfer(client: TestClient):
    alice_data = _register(client, "alice_t16")
    bob_data = _register(client, "bob_t16")
    alice_token = _login(client, "alice_t16")

    r = _post_transfer(client, alice_token, {"destination_wallet_id": bob_data["wallet"]["id"], "amount": 1_000})
    transfer_id = r.json()["transfer"]["id"]

    resp = client.get(f"/transfers/{transfer_id}", headers=_auth(alice_token))
    assert resp.status_code == 200
    assert resp.json()["transfer"]["id"] == transfer_id


def test_destination_participant_can_get_transfer(client: TestClient):
    _register(client, "alice_t17")
    bob_data = _register(client, "bob_t17")
    alice_token = _login(client, "alice_t17")
    bob_token = _login(client, "bob_t17")

    r = _post_transfer(client, alice_token, {"destination_wallet_id": bob_data["wallet"]["id"], "amount": 1_000})
    transfer_id = r.json()["transfer"]["id"]

    resp = client.get(f"/transfers/{transfer_id}", headers=_auth(bob_token))
    assert resp.status_code == 200


def test_non_participant_gets_404(client: TestClient):
    _register(client, "alice_t18")
    bob_data = _register(client, "bob_t18")
    _register(client, "carol_t18")
    alice_token = _login(client, "alice_t18")
    carol_token = _login(client, "carol_t18")

    r = _post_transfer(client, alice_token, {"destination_wallet_id": bob_data["wallet"]["id"], "amount": 1_000})
    transfer_id = r.json()["transfer"]["id"]

    resp = client.get(f"/transfers/{transfer_id}", headers=_auth(carol_token))
    assert resp.status_code == 404


def test_unknown_transfer_id_gets_404(client: TestClient):
    _register(client, "alice_t19")
    token = _login(client, "alice_t19")

    resp = client.get("/transfers/txop_nonexistent", headers=_auth(token))
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Username resolution tests
# ---------------------------------------------------------------------------

def test_create_transfer_by_username_returns_201(client: TestClient):
    alice_data = _register(client, "alice_u1")
    bob_data = _register(client, "bob_u1")
    alice_token = _login(client, "alice_u1")

    resp = _post_transfer(client, alice_token, {"destination_username": "bob_u1", "amount": 10_000})

    assert resp.status_code == 201
    t = resp.json()["transfer"]
    assert t["id"].startswith("txop_")
    assert t["source_wallet_id"] == alice_data["wallet"]["id"]
    assert t["destination_wallet_id"] == bob_data["wallet"]["id"]
    assert t["amount"] == 10_000
    assert t["currency"] == "COP"
    assert t["origin"] == "manual_transfer"
    assert t["status"] == "completed"


def test_create_transfer_destination_user_not_found_returns_404(client: TestClient):
    _register(client, "alice_u2")
    alice_token = _login(client, "alice_u2")

    resp = _post_transfer(client, alice_token, {"destination_username": "nonexistent_user", "amount": 5_000})

    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "destination_user_not_found"


def test_create_transfer_both_wallet_id_and_username_returns_400(client: TestClient):
    alice_data = _register(client, "alice_u3")
    bob_data = _register(client, "bob_u3")
    alice_token = _login(client, "alice_u3")

    resp = _post_transfer(
        client, alice_token,
        {"destination_wallet_id": bob_data["wallet"]["id"], "destination_username": "bob_u3", "amount": 5_000}
    )

    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "invalid_request"


def test_create_transfer_neither_wallet_id_nor_username_returns_400(client: TestClient):
    _register(client, "alice_u4")
    alice_token = _login(client, "alice_u4")

    resp = _post_transfer(client, alice_token, {"amount": 5_000})

    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "invalid_request"


def test_create_transfer_idempotency_works_with_username(client: TestClient):
    _register(client, "alice_u5")
    bob_data = _register(client, "bob_u5")
    alice_token = _login(client, "alice_u5")

    payload = {"destination_username": "bob_u5", "amount": 5_000}
    r1 = _post_transfer(client, alice_token, payload, key="idem-username-001")
    r2 = _post_transfer(client, alice_token, payload, key="idem-username-001")

    assert r1.status_code == 201
    assert r2.status_code == 201
    assert r1.json() == r2.json()
    assert r1.json()["transfer"]["destination_wallet_id"] == bob_data["wallet"]["id"]


# ---------------------------------------------------------------------------
# Concurrency test — must use independent DB sessions
# ---------------------------------------------------------------------------

def test_concurrent_transfers_prevent_double_spend():
    """Two concurrent transfers each trying to spend the entire balance.
    Exactly one must succeed and one must fail with insufficient_balance.
    Source balance must never go negative.
    """
    from flowpay.main import app

    engine = create_engine(TEST_DATABASE_URL)

    # Bootstrap two users in an isolated session that commits immediately
    setup_session = Session(engine)
    try:
        # Import and register via the app — easier than direct DB writes
        pass
    finally:
        setup_session.close()

    # Use TestClient with a fresh DB (not the savepoint fixture)
    # Each client call gets its own session via get_db

    with TestClient(app) as c:
        alice = c.post("/auth/register", json={"username": "alice_conc", "password": "pw"})
        bob = c.post("/auth/register", json={"username": "bob_conc", "password": "pw"})

        if alice.status_code != 201 or bob.status_code != 201:
            # Users already exist from a previous run; log in instead
            alice_token_resp = c.post("/auth/login", json={"username": "alice_conc", "password": "pw"})
            bob_token = None  # not needed
            alice_token = alice_token_resp.json()["access_token"]
            bob_wallet_id = c.post(
                "/auth/login", json={"username": "bob_conc", "password": "pw"}
            ).json()  # not used directly
            # In CI the DB is clean; guard against flaky re-runs by bailing
            pytest.skip("Concurrency test requires a clean database state")

        alice_token = c.post("/auth/login", json={"username": "alice_conc", "password": "pw"}).json()["access_token"]
        bob_wallet_id = bob.json()["wallet"]["id"]
        alice_wallet_id = alice.json()["wallet"]["id"]

        results = []
        barrier = threading.Barrier(2)

        def do_transfer(key: str):
            barrier.wait()  # synchronize both threads to start simultaneously
            r = c.post(
                "/transfers",
                json={"destination_wallet_id": bob_wallet_id, "amount": 50_000},
                headers={"Authorization": f"Bearer {alice_token}", "Idempotency-Key": key},
            )
            results.append(r.status_code)

        t1 = threading.Thread(target=do_transfer, args=("conc-key-1",))
        t2 = threading.Thread(target=do_transfer, args=("conc-key-2",))
        t1.start()
        t2.start()
        t1.join()
        t2.join()

    assert sorted(results) == [201, 409], f"Expected one success and one failure, got: {results}"

    # Verify balance never went negative
    check_session = Session(engine)
    try:
        from flowpay.composition import build_ledger_service
        svc = build_ledger_service(check_session)
        bal = svc.get_wallet_balance(alice_wallet_id)
        assert bal.balance >= 0
    finally:
        check_session.close()
        engine.dispose()
