# FlowPay Backend — Register Integration (UC-01 Complete)

## Overview

Complete `POST /auth/register` so that, in addition to creating user and credentials, it also creates the wallet and registers the welcome bonus of 50,000 COP. Update the response to include the wallet with derived balance. This closes UC-01 end-to-end with orchestration in an application layer; the HTTP router remains thin and only translates request/response and errors.

---

## Files Analyzed

1. `backend/src/flowpay/auth/adapters/router.py` (108 lines)
   - `RegisterResponse` (lines 25-26): currently only has `user: UserResponse`
   - `register()` (lines 45-62): calls `auth_service.register()`, returns only `user`
   - Pattern: already imports `build_auth_service` and `get_db`

2. `backend/src/flowpay/auth/application/auth_service.py` (64 lines)
   - `AuthService.register()` (lines 30-42): creates user + hash password. Returns `UserSummary`
   - **Does not change** — its responsibility is only auth, not wallets

3. `backend/src/flowpay/composition.py` (37 lines)
   - Already has `build_wallet_service(db)` and `build_ledger_service(db)`
   - Changes to expose `build_registration_service(db)`

4. `backend/src/flowpay/wallets/application/wallet_service.py` (52 lines)
   - `create_wallet(user_id)` (lines 19-28): creates COP wallet, returns `WalletSummary`

5. `backend/src/flowpay/ledger/application/ledger_service.py` (147 lines)
   - `record_welcome_bonus(wallet_id, amount)` (lines 35-62): persists `welcome_bonus` credit
   - Changes so that the fixed amount lives in application/ledger, not in the HTTP router

6. `backend/tests/integration/auth/test_register.py` (79 lines)
   - `test_register_returns_201_and_persists_user` (line 4): currently does NOT verify wallet or balance
   - 5 existing tests — all remain valid, only the first needs expansion

7. `backend/tests/unit/auth/test_auth_service.py` (131 lines)
   - Tests of pure `AuthService` with mocks — **does not change**, `AuthService.register()` does not mutate

8. `backend/tests/unit/auth/test_registration_service.py` (new)
   - Unit tests of the cross-module use case without FastAPI or SQLAlchemy

---

## Current State Analysis

```
POST /auth/register today:
  1. auth_service.register(username, password)
     ├─ user_service.create_user(username)     ✅
     └─ credentials_repo.create(user_id, hash) ✅
  2. return { user: { id, username } }          ✅

Missing:
  3. registration_service.register(username, password)   ❌
     ├─ auth_service.register(...)
     ├─ wallet_service.create_wallet(user_id)
     ├─ ledger_service.record_welcome_bonus(wallet_id)
     └─ ledger_service.get_wallet_balance(wallet_id)
  4. return { user, wallet: { id, currency, balance } }  ❌
```

Current response vs API contract:

```python
# Current
{ "user": { "id": "usr_123", "username": "alice" } }

# Contract (docs/specs/04-api-contract.md)
{
  "user": { "id": "usr_123", "username": "alice" },
  "wallet": { "id": "wal_123", "currency": "COP", "balance": 50000 }
}
```

---

## Dependency Analysis

```mermaid
graph TB
    Client["HTTP Client"]
    Router["auth/adapters/router.py\nPOST /auth/register"]
    RegistrationSvc["auth/application/registration_service.py\nRegistrationService.register()"]
    AuthSvc["auth/application/auth_service.py\nAuthService.register()"]
    WalletSvc["wallets/application/wallet_service.py\nWalletService.create_wallet()"]
    LedgerSvc["ledger/application/ledger_service.py\nrecord_welcome_bonus() + get_wallet_balance()"]
    Composition["composition.py"]
    DB["PostgreSQL\nusers + wallets + ledger_transactions"]

    Client -->|POST /auth/register| Router
    Router -->|build_registration_service| Composition
    Composition --> RegistrationSvc
    RegistrationSvc --> AuthSvc
    RegistrationSvc --> WalletSvc
    RegistrationSvc --> LedgerSvc
    AuthSvc --> DB
    WalletSvc --> DB
    LedgerSvc --> DB

    style Router fill:#7ed321
    style RegistrationSvc fill:#4a90e2
    style AuthSvc fill:#4a90e2
    style WalletSvc fill:#4a90e2
    style LedgerSvc fill:#4a90e2
```

**Module rule:** the HTTP router does NOT implement financial rules. The orchestration lives in an application service (`RegistrationService`) built by `composition.py`. `AuthService.register()` remains focused on credentials, while the complete registration use case calls public services from `auth`, `wallets` and `ledger` within the same SQLAlchemy session.

---

## Proposed Changes

### Files to Modify

#### 1. `backend/src/flowpay/auth/application/registration_service.py` (new)

Create an application service for the complete UC-01 use case:

```python
from dataclasses import dataclass


@dataclass
class RegisteredWalletSummary:
    id: str
    currency: str
    balance: int


@dataclass
class RegistrationSummary:
    user_id: str
    username: str
    wallet: RegisteredWalletSummary


class RegistrationService:
    def __init__(self, auth_service, wallet_service, ledger_service):
        self.auth_service = auth_service
        self.wallet_service = wallet_service
        self.ledger_service = ledger_service

    def register(self, username: str, password: str) -> RegistrationSummary:
        user_summary = self.auth_service.register(username, password)
        wallet_summary = self.wallet_service.create_wallet(user_summary.id)
        self.ledger_service.record_welcome_bonus(wallet_summary.id)
        balance = self.ledger_service.get_wallet_balance(wallet_summary.id)

        return RegistrationSummary(
            user_id=user_summary.id,
            username=user_summary.username,
            wallet=RegisteredWalletSummary(
                id=wallet_summary.id,
                currency=wallet_summary.currency,
                balance=balance.balance,
            ),
        )
```

**Rationale:**
- The router does not contain financial rules or know the bonus amount.
- `AuthService.register()` does not change — pure auth continues creating user + credentials.
- The complete use case is tested without FastAPI.
- The session remains unique because `composition.py` injects services built with the same `db`.

---

#### 2. `backend/src/flowpay/ledger/application/ledger_service.py`

Move the fixed welcome bonus amount to the ledger/application module and prevent external callers from passing the amount:

```python
WELCOME_BONUS_AMOUNT = 50_000


class LedgerService:
    ...

    def record_welcome_bonus(self, wallet_id: str) -> TransactionSummary:
        transaction_id = generate_id("txn_")
        record = self.repository.create_entry(
            transaction_id=transaction_id,
            wallet_id=wallet_id,
            type="credit",
            amount=WELCOME_BONUS_AMOUNT,
            source="welcome_bonus",
            operation_id=None,
            counterparty_wallet_id=None,
        )
        return self._to_summary(record)
```

**Changes:**
- Add `WELCOME_BONUS_AMOUNT = 50_000` in `ledger_service.py`
- Change `record_welcome_bonus(wallet_id, amount)` to `record_welcome_bonus(wallet_id)`
- Update existing tests that call `record_welcome_bonus(..., 50_000)`

**Rationale:** ADR 0004 says the amount is hardcoded in domain/application and subject to tests, not in configuration or HTTP adapters.

---

#### 3. `backend/src/flowpay/composition.py`

Add builder for the complete use case:

```python
from flowpay.auth.application.registration_service import RegistrationService


def build_registration_service(db: Session) -> RegistrationService:
    return RegistrationService(
        auth_service=build_auth_service(db),
        wallet_service=build_wallet_service(db),
        ledger_service=build_ledger_service(db),
    )
```

**Rationale:** `composition.py` is the allowed point to connect adapters and services from different modules.

---

#### 4. `backend/src/flowpay/auth/adapters/router.py`

**Changes in imports:**
```python
from flowpay.composition import build_auth_service, build_registration_service
```

**Current lines 25-26 (`RegisterResponse`):**
```python
class RegisterResponse(BaseModel):
    user: UserResponse
```

**Proposed:**
```python
class WalletRegistrationResponse(BaseModel):
    id: str
    currency: str
    balance: int


class RegisterResponse(BaseModel):
    user: UserResponse
    wallet: WalletRegistrationResponse
```

**Changes:** +6 lines (new model, wallet field in RegisterResponse)

**Rationale:** `WalletRegistrationResponse` is defined locally to avoid creating dependency between adapters of different modules. Does not reuse `WalletResponse` from `ledger/adapters/router.py`.

---

**Current lines 45-62 (endpoint `register`):**
```python
@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(
    request: RegisterRequest,
    db: Session = Depends(get_db),
) -> RegisterResponse:
    """Register a new user."""
    auth_service = build_auth_service(db)
    try:
        user_summary = auth_service.register(request.username, request.password)
    except UsernameAlreadyExistsError:
        raise FlowPayHTTPError(
            code="username_already_exists",
            message="Username is already taken",
            status_code=409,
        )
    return RegisterResponse(
        user=UserResponse(id=user_summary.id, username=user_summary.username)
    )
```

**Proposed:**
```python
@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(
    request: RegisterRequest,
    db: Session = Depends(get_db),
) -> RegisterResponse:
    registration_service = build_registration_service(db)

    try:
        summary = registration_service.register(request.username, request.password)
    except UsernameAlreadyExistsError:
        raise FlowPayHTTPError(
            code="username_already_exists",
            message="Username is already taken",
            status_code=409,
        )

    return RegisterResponse(
        user=UserResponse(id=summary.user_id, username=summary.username),
        wallet=WalletRegistrationResponse(
            id=summary.wallet.id,
            currency=summary.wallet.currency,
            balance=summary.wallet.balance,
        ),
    )
```

**Changes:** router remains thin: build the use case, HTTP error handling, response model.

**Rationale:**
- `AuthService.register()` does not change — auth does not need to know about wallets
- Orchestration moves out of the HTTP adapter and stays in application
- `balance` comes from `ledger_service.get_wallet_balance()`, fulfilling the derived balance contract
- If `record_welcome_bonus` fails, the session rolls back wallet and user — atomicity guaranteed by SQLAlchemy's unit of work

**Side effects:**
- The response shape of `POST /auth/register` changes: adds `wallet` field. Forward compatible (new field, not removed).

---

#### 5. `backend/tests/unit/auth/test_registration_service.py` (new)

Add unit tests for the use case:

```python
def test_registration_service_creates_user_wallet_bonus_and_returns_derived_balance():
    ...


def test_registration_service_stops_when_username_already_exists():
    ...
```

**Must verify:**
- calls `auth_service.register(username, password)`
- creates wallet with `user_id`
- registers welcome bonus with `wallet_id` without passing amount from caller
- gets derived balance from `ledger_service.get_wallet_balance(wallet_id)`
- returns `RegistrationSummary`
- if `auth_service.register()` fails due to duplicate username, does not create wallet or ledger entry

---

#### 6. `backend/tests/integration/auth/test_register.py`

**Current lines 4-16:**
```python
def test_register_returns_201_and_persists_user(client: TestClient):
    """Test that register returns 201 and persists both user and credential rows."""
    response = client.post(
        "/auth/register",
        json={"username": "alice", "password": "password123"},
    )

    assert response.status_code == 201
    data = response.json()
    assert "user" in data
    assert data["user"]["username"] == "alice"
    assert data["user"]["id"].startswith("usr_")
```

**Proposed — renamed and expanded test:**
```python
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
```

**New tests to add at the end of the file:**
```python
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
    txn = db.query(LedgerTransaction).filter(
        LedgerTransaction.wallet_id == wallet.id
    ).first()

    assert txn is not None
    assert txn.type == "credit"
    assert txn.source == "welcome_bonus"
    assert txn.amount == 50_000
```

**Changes:** +2 new integration tests (~35 lines), 1 modified integration test (~3 lines)

---

### Files NOT to Create
- No migration — no schema changes
- No additional documentation files
- No new onboarding module — UC-01 is implemented as a small application service within `auth/application`

---

## Implementation Steps

### Step 1: Adjust ledger to own the welcome bonus rule

Modify `backend/src/flowpay/ledger/application/ledger_service.py`:
- Add `WELCOME_BONUS_AMOUNT = 50_000`
- Change `record_welcome_bonus(wallet_id, amount)` to `record_welcome_bonus(wallet_id)`
- Use the fixed amount within the service
- Update existing unit/integration tests that call the method with `amount`

**Verification:**
```bash
cd backend && AUTH_SECRET_KEY=dev \
  DATABASE_URL_TEST=postgresql+psycopg://flowpay:flowpay@localhost:5433/flowpay_test \
  uv run pytest tests/unit/ledger/ tests/integration/ledger/ -v
```

---

### Step 2: Create the complete registration use case

Create `backend/src/flowpay/auth/application/registration_service.py`:
- Define `RegistrationService`
- Define DTOs `RegistrationSummary` and `RegisteredWalletSummary`
- Orchestrate `auth_service.register()`, `wallet_service.create_wallet()`, `ledger_service.record_welcome_bonus()` and `ledger_service.get_wallet_balance()`
- Do not import FastAPI, SQLAlchemy, ORM models or Pydantic

Update `backend/src/flowpay/composition.py`:
- Import `RegistrationService`
- Add `build_registration_service(db)`
- Reuse existing builders to inject services with the same session

---

### Step 3: Update the auth router

Modify `backend/src/flowpay/auth/adapters/router.py`:
- Add `build_registration_service` to the import from `composition`
- Add model `WalletRegistrationResponse` before `RegisterResponse`
- Add field `wallet: WalletRegistrationResponse` to `RegisterResponse`
- Update the body of the `register` endpoint to call only `registration_service.register(...)`
- Keep HTTP error handling for `UsernameAlreadyExistsError`

**Verification:**
```bash
cd backend && AUTH_SECRET_KEY=dev DATABASE_URL=postgresql+psycopg://flowpay:flowpay@localhost:5432/flowpay \
  uv run python -c "from flowpay.auth.adapters.router import router; print('OK')"
```

---

### Step 4: Update registration tests

Create `backend/tests/unit/auth/test_registration_service.py`:
- Test the orchestration of the use case without FastAPI or database
- Test that if username already exists, no wallet or ledger entry is created

Modify `backend/tests/integration/auth/test_register.py`:
- Rename `test_register_returns_201_and_persists_user` → `test_register_returns_201_with_user_and_wallet`
- Expand its assertions to include `wallet`
- Add `test_register_creates_wallet_persisted_in_db`
- Add `test_register_records_welcome_bonus_in_ledger`

---

### Step 5: Run complete suite

```bash
AUTH_SECRET_KEY=dev \
  DATABASE_URL_TEST=postgresql+psycopg://flowpay:flowpay@localhost:5433/flowpay_test \
  uv run pytest tests/ -v
```

**Expected output:** 68+ tests, 0 failures.

---

## Scope Boundaries

### What IS implemented:
- Wallet created automatically in `POST /auth/register`
- Welcome bonus of 50,000 COP recorded in ledger when creating account
- Register response includes `wallet.id`, `wallet.currency`, `wallet.balance` derived from ledger
- Application service `RegistrationService` to keep router thin
- 2 new unit tests + 2 new integration tests + 1 updated integration test

### What is NOT implemented:
- Configurable bonus amount (it's a fixed domain rule for now)
- `AuthService.register()` does not change — auth remains independent of wallets
- No schema changes / migration
- NFC, transfers — out of scope for this plan

### Assumptions:
- The welcome bonus amount is 50,000 COP (confirmed by `docs/specs/04-api-contract.md` and ADR 0004)
- `db.commit()` is handled by session middleware — if `record_welcome_bonus` fails, the entire transaction rolls back including wallet and user (atomicity guaranteed by SQLAlchemy's unit of work)
- Tables `wallets` and `ledger_transactions` already exist in the schema (wallets module + ledger module already applied)

---

## Rollback Plan

```bash
git revert HEAD
```

No migration to revert — no schema changes.

---

## Success Criteria

- [ ] `POST /auth/register` returns `{ user, wallet }` with `balance: 50000`
- [ ] The auth router does not contain the bonus amount or call wallet/ledger directly
- [ ] `RegistrationService` orchestrates UC-01 without importing FastAPI, SQLAlchemy or ORM
- [ ] The returned balance is obtained with `ledger_service.get_wallet_balance()`
- [ ] Wallet persists in `wallets` table linked to `user_id`
- [ ] `welcome_bonus` transaction persists in `ledger_transactions` with `amount: 50000`
- [ ] Unit tests of `RegistrationService` pass
- [ ] Auth tests pass: `uv run pytest tests/integration/auth/ -v`
- [ ] Architecture without regression: `uv run pytest tests/architecture/ -v`
- [ ] Complete suite passes: `uv run pytest tests/ -v` (68+ tests, 0 failures)

---

## TL;DR

- **Total files to modify:** 5 (`router.py`, `composition.py`, `ledger_service.py`, register tests, existing ledger tests if applicable)
- **Total files to create:** 2 (`registration_service.py`, `test_registration_service.py`)
- **Estimated lines:** ~90 added / ~10 deleted / ~15 modified
- **Deliverables:** complete register endpoint per API contract, application use case, derived balance, unit and integration tests, UC-01 closed
- **Does not include:** schema changes, bonus configurability, NFC, transfers

## Team TL;DR

**What we build:** When registering, each user now automatically receives a wallet with 50,000 COP initial balance — no extra steps.

**Why it matters:** Closes the complete onboarding flow. A registered user can immediately see their balance and make transfers (when ready), without additional setup.

**Timeline impact:** Small-moderate change (~1-2 hours), unlocks the transfers module and leaves a correct pattern for future cross-module use cases.
