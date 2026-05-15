# FlowPay Backend - Transfers Module (UC-04)

## Overview

Implement `POST /transfers` and `GET /transfers/{transfer_id}` with full database atomicity, PostgreSQL row locking, idempotency through the `Idempotency-Key` header, and real concurrency tests.

This is the financial core of the product. The implementation must optimize for correctness, auditability, and module boundaries before convenience.

---

## Files Analyzed

### Core Documents

1. `docs/specs/01-domain-rules.md` - Transfer rules: debit + credit, same amount, same `operation_id`, no negative balances.
2. `docs/specs/03-domain-model.md` - `TransferOperation` entity, fields, statuses, and invariants.
3. `docs/specs/04-api-contract.md` - Endpoint contracts, request/response shapes, `Idempotency-Key`, and expected errors.
4. `docs/specs/05-persistence-model.md` - `transfer_operations`, `idempotency_keys`, constraints, and write transaction order.
5. `docs/specs/06-testing-strategy.md` - Required concurrency test, visible idempotency contract, and real PostgreSQL requirement.
6. `docs/adr/0001-backend-architecture.md` - Modular monolith, boundaries, and allowed cross-module interactions.
7. `docs/adr/0004-money-and-ledger-model.md` - Money movement order, `SELECT ... FOR UPDATE`, idempotency scoped to user.

### Existing Backend Files

1. `backend/src/flowpay/composition.py` - Existing `build_*_service(db)` pattern.
2. `backend/src/flowpay/main.py` - FastAPI app and router registration.
3. `backend/src/flowpay/database.py` - `get_db()` and session lifecycle.
4. `backend/src/flowpay/shared/errors.py` - `FlowPayHTTPError`.
5. `backend/src/flowpay/shared/ids.py` - `generate_id(prefix)`.
6. `backend/src/flowpay/auth/adapters/dependencies.py` - `get_current_user_id`.
7. `backend/src/flowpay/ledger/application/ledger_service.py` - Existing `record_transfer_entries()` and `get_wallet_balance()`.
8. `backend/src/flowpay/ledger/adapters/ledger_repository.py` - SQL-backed ledger writes and balance calculation.
9. `backend/src/flowpay/ledger/adapters/ledger_orm.py` - `LedgerTransaction`.
10. `backend/src/flowpay/ledger/ports/ledger_repository.py` - Existing Protocol + dataclass port pattern.
11. `backend/src/flowpay/wallets/adapters/wallet_orm.py` - `Wallet` ORM, owned by the `wallets` module.
12. `backend/src/flowpay/wallets/adapters/wallet_repository.py` - Existing `get_by_id()` and `get_by_user_id()`.
13. `backend/src/flowpay/wallets/ports/wallet_repository.py` - `WalletRecord` and `WalletRepository`.
14. `backend/src/flowpay/ledger/adapters/router.py` - Existing thin router pattern.
15. `backend/src/flowpay/auth/application/registration_service.py` - Existing cross-module service usage reference.
16. `backend/migrations/env.py` - Alembic model registration.
17. `backend/migrations/versions/c87dd4f707cd_*.py` - Existing migration style.
18. `backend/tests/conftest.py` - DB/client fixtures and savepoint rollback pattern.
19. `backend/tests/architecture/test_backend_boundaries.py` - Existing boundary tests.
20. `backend/tests/integration/auth/test_register.py` - Integration test style reference.
21. `backend/src/flowpay/transfers/` - Existing empty module package.

---

## Current State

```text
transfers/
  __init__.py
  adapters/__init__.py
  application/__init__.py
  domain/__init__.py
  ports/__init__.py
```

`main.py` does not register a transfers router. `composition.py` does not expose `build_transfer_service`. There are no ORM models or migrations for `transfer_operations` or `idempotency_keys`.

`LedgerService.record_transfer_entries()` already exists and should be reused directly. It writes the debit and credit ledger entries inside the caller's database transaction.

---

## Architectural Rules

### Module Boundary Rule

`TransferService` may call `WalletService` and `LedgerService` through their public application APIs.

The source wallet lock must live in the `wallets` module because `wallets` owns the `wallets` table. The `transfers` module orchestrates the money-moving use case, but it must not import `Wallet` ORM, import `flowpay.wallets.adapters`, or query another module's table directly.

Application code must remain independent from FastAPI, SQLAlchemy, database clients, and HTTP status codes.

### Transaction Rule

`build_transfer_service(db)` must construct `TransferService`, `WalletService`, `LedgerService`, `SQLAlchemyTransferRepository`, and `SQLAlchemyIdempotencyRepository` with the same `Session` instance.

No service or repository in the transfer flow may open a second SQLAlchemy session.

This preserves one database transaction for:

- source wallet lock;
- balance calculation;
- `transfer_operations` insert;
- ledger debit and credit inserts;
- idempotency result insert.

### Dependency Shape

```mermaid
graph TB
    Client["HTTP Client"]
    Router["transfers/adapters/router.py\nPOST /transfers\nGET /transfers/id"]
    TransferSvc["transfers/application/transfer_service.py\nTransferService"]
    TransferRepo["transfers/adapters/repositories.py\ninsert transfer_operations"]
    IdempRepo["transfers/adapters/repositories.py\ncheck + store idempotency_keys"]
    WalletSvc["wallets/application/wallet_service.py\nlock_by_user_id + get_by_id"]
    WalletRepo["wallets/adapters/wallet_repository.py\nSELECT FOR UPDATE on wallets"]
    LedgerSvc["ledger/application/ledger_service.py\nget_wallet_balance\nrecord_transfer_entries"]
    Composition["composition.py\nbuild_transfer_service"]
    DB["PostgreSQL\ntransfer_operations\nidempotency_keys\nledger_transactions\nwallets"]

    Client -->|POST /transfers\nGET /transfers/id| Router
    Router -->|build_transfer_service| Composition
    Composition --> TransferSvc
    TransferSvc --> TransferRepo
    TransferSvc --> IdempRepo
    TransferSvc --> WalletSvc
    TransferSvc --> LedgerSvc
    TransferRepo -->|INSERT transfer_operations| DB
    IdempRepo -->|SELECT + INSERT| DB
    WalletSvc --> WalletRepo
    WalletRepo -->|SELECT FOR UPDATE| DB
    LedgerSvc --> DB
```

---

## Proposed Runtime Design

### Files to Create

#### 1. `backend/src/flowpay/transfers/adapters/orm.py` (~55 lines)

Define both ORM models owned by the `transfers` module:

- `TransferOperation`
- `IdempotencyKey`

Tables:

- `transfer_operations`
- `idempotency_keys`

Important constraints:

- transfer amount must be greater than `0`;
- source and destination wallet IDs must differ;
- currency is fixed to `COP`;
- origin is one of `manual_transfer`, `nfc_transfer`;
- status is one of `completed`, `failed`;
- idempotency key is unique by `(user_id, key)`.

This file may reference foreign key table names such as `wallets.id` and `users.id`, but it must not import another module's ORM class.

#### 2. `backend/src/flowpay/transfers/ports/repositories.py` (~45 lines)

Define compact repository ports and data records for the `transfers` module:

- `TransferRecord`
- `TransferRepository`
- `IdempotencyRecord`
- `IdempotencyRepository`

Keep these as simple dataclasses and Protocols. Do not add a separate domain layer for V1 unless implementation reveals real domain logic that belongs there.

#### 3. `backend/src/flowpay/transfers/adapters/repositories.py` (~85 lines)

Implement:

- `SQLAlchemyTransferRepository`
- `SQLAlchemyIdempotencyRepository`

Rules:

- use the injected `Session`;
- do not call `commit()` or `rollback()`;
- do not create a new `Session`;
- do not import `flowpay.wallets.adapters`;
- do not import `Wallet` ORM;
- only write tables owned by `transfers`.

`SQLAlchemyTransferRepository` inserts and reads `transfer_operations`.

`SQLAlchemyIdempotencyRepository` checks and stores `idempotency_keys`.

#### 4. `backend/src/flowpay/transfers/application/transfer_service.py` (~85 lines)

Implement `TransferService`.

Public methods:

- `create_transfer(user_id, destination_wallet_id, amount, origin, idempotency_key, request_hash)`
- `get_transfer(transfer_id, user_id)`

Application errors:

- one `TransferError(code, message)`;
- one `IdempotencyReplayError(response_status, response_body)` for returning cached idempotent responses.

The service must:

1. validate positive amount;
2. lock the authenticated user's source wallet through `wallet_service.lock_by_user_id(user_id)`;
3. reject source and destination being the same wallet;
4. validate the destination wallet through `wallet_service.get_by_id(destination_wallet_id)`;
5. check idempotency after acquiring the source wallet lock;
6. calculate source balance through `ledger_service.get_wallet_balance(source_wallet.id)`;
7. reject insufficient balance;
8. create `TransferOperation`;
9. record debit and credit through `ledger_service.record_transfer_entries(...)`;
10. store the idempotency result;
11. return a `TransferSummary`.

Critical invariant: `wallet_service.lock_by_user_id(user_id)` must happen before balance calculation and ledger writes.

#### 5. `backend/src/flowpay/transfers/adapters/router.py` (~75 lines)

Implement FastAPI adapter endpoints:

- `POST /transfers`
- `GET /transfers/{transfer_id}`

Router responsibilities:

- parse request body;
- require `Idempotency-Key` for `POST /transfers`;
- compute a stable request hash from the request payload;
- call `build_transfer_service(db)`;
- map `TransferError.code` to HTTP status;
- return cached response for `IdempotencyReplayError`;
- expose Pydantic request/response models.

The router may import FastAPI and SQLAlchemy `Session`. The application service may not.

### Files to Modify

#### 1. `backend/src/flowpay/wallets/ports/wallet_repository.py` (+4 lines)

Add a public repository port method owned by `wallets`:

```python
def lock_by_user_id(self, user_id: str) -> WalletRecord | None:
    """Acquire SELECT ... FOR UPDATE on the user's wallet row."""
    ...
```

#### 2. `backend/src/flowpay/wallets/adapters/wallet_repository.py` (+14 lines)

Implement `lock_by_user_id(user_id)` using:

```python
self.session.query(Wallet).filter(Wallet.user_id == user_id).with_for_update().first()
```

Return `WalletRecord | None`.

Rules:

- use the injected `Session`;
- do not commit or rollback;
- do not create another session.

#### 3. `backend/src/flowpay/wallets/application/wallet_service.py` (+11 lines)

Expose `lock_by_user_id(user_id)` as public application API.

`transfers` calls this method. It does not call wallet repositories or wallet adapters directly.

#### 4. `backend/src/flowpay/composition.py` (+11 lines)

Add imports:

```python
from flowpay.transfers.adapters.repositories import (
    SQLAlchemyIdempotencyRepository,
    SQLAlchemyTransferRepository,
)
from flowpay.transfers.application.transfer_service import TransferService
```

Add:

```python
def build_transfer_service(db: Session) -> TransferService:
    return TransferService(
        transfer_repository=SQLAlchemyTransferRepository(db),
        idempotency_repository=SQLAlchemyIdempotencyRepository(db),
        wallet_service=build_wallet_service(db),
        ledger_service=build_ledger_service(db),
    )
```

The `db` argument is the only `Session` for this use case. Every service and repository created here must share it.

#### 5. `backend/src/flowpay/main.py` (+2 lines)

Register the transfers router:

```python
from flowpay.transfers.adapters.router import router as transfers_router

app.include_router(transfers_router, tags=["transfers"])
```

#### 6. `backend/migrations/env.py` (+1 line)

Register transfers ORM metadata for Alembic:

```python
import flowpay.transfers.adapters.orm  # noqa: F401
```

#### 7. `backend/tests/architecture/test_backend_boundaries.py` (+45 lines)

Add boundary tests:

- `transfers.application` must not import FastAPI;
- `transfers.application` must not import SQLAlchemy;
- `transfers` must not import `flowpay.wallets.adapters`.

---

## Migration

### File to Create

`backend/migrations/versions/XXXX_create_transfer_operations_and_idempotency_keys.py` (~80 lines)

Create:

- `transfer_operations`
- `idempotency_keys`

Migration constraints:

- `transfer_operations.id` primary key;
- `transfer_operations.source_wallet_id` references `wallets.id`;
- `transfer_operations.destination_wallet_id` references `wallets.id`;
- `transfer_operations.amount > 0`;
- `transfer_operations.source_wallet_id <> destination_wallet_id`;
- `transfer_operations.currency = 'COP'`;
- `transfer_operations.origin IN ('manual_transfer', 'nfc_transfer')`;
- `transfer_operations.status IN ('completed', 'failed')`;
- indexes on source wallet, destination wallet, and created time;
- `idempotency_keys.user_id` references `users.id`;
- unique constraint on `(user_id, key)`;
- `idempotency_keys.response_body` should be PostgreSQL `JSONB`.

Do not add a database FK from `ledger_transactions.operation_id` to `transfer_operations.id` in V1. `ledger` owns ledger rows, and the existing ledger constraints already require `operation_id` for transfer sources. A cross-module FK can be revisited later if the team accepts that coupling.

---

## Tests

### File to Create

`backend/tests/integration/transfers/test_transfers.py` (~230 lines)

Use real PostgreSQL. Do not rely on mocks for locking, transactions, constraints, or concurrency.

Coverage:

- create manual transfer returns `201` with expected response shape;
- create NFC transfer uses `nfc_transfer` as ledger source;
- transfer creates exactly one debit and one credit;
- debit and credit share `operation_id` and amount;
- source balance decreases;
- destination balance increases;
- missing `Idempotency-Key` returns `400 invalid_request`;
- zero amount returns `400 invalid_amount`;
- negative amount returns `400 invalid_amount`;
- same wallet transfer returns `400 same_wallet_transfer`;
- destination wallet not found returns `404 destination_wallet_not_found`;
- insufficient balance returns `409 insufficient_balance` and creates no ledger entries;
- unauthenticated request returns `401`;
- same idempotency key + same payload returns original response;
- same idempotency key + same payload does not create a second transfer;
- same idempotency key + different payload returns `409 idempotency_key_conflict`;
- idempotency keys are scoped by user;
- source participant can get transfer;
- destination participant can get transfer;
- non-participant gets `404`;
- unknown transfer ID gets `404`;
- concurrent transfers from the same source wallet prevent double spend.

### Concurrency Test Rule

The concurrency test must use independent sessions outside the normal savepoint-based `conftest.py` fixture. Nested savepoints do not simulate real row-lock contention across OS threads.

Expected outcome:

- two concurrent transfers attempt to spend more than the available source balance;
- exactly one succeeds;
- exactly one fails with `insufficient_balance`;
- source balance never becomes negative;
- successful transfer writes exactly one debit and one credit.

---

## Implementation Steps

### Step 1: Add Transfers ORM and Ports

Create:

- `transfers/adapters/orm.py`
- `transfers/ports/repositories.py`

Verification:

```bash
cd backend && AUTH_SECRET_KEY=dev DATABASE_URL=postgresql+psycopg://flowpay:flowpay@localhost:5432/flowpay \
  uv run python -c "from flowpay.transfers.adapters.orm import TransferOperation; print('OK')"
```

### Step 2: Generate and Apply Migration

Register ORM metadata in `migrations/env.py`, then generate:

```bash
cd backend && AUTH_SECRET_KEY=dev DATABASE_URL=postgresql+psycopg://flowpay:flowpay@localhost:5432/flowpay \
  uv run alembic revision --autogenerate -m "create transfer_operations and idempotency_keys"
```

Review and manually adjust the migration. Ensure `response_body` is `postgresql.JSONB()`.

Apply to development DB:

```bash
cd backend && AUTH_SECRET_KEY=dev DATABASE_URL=postgresql+psycopg://flowpay:flowpay@localhost:5432/flowpay \
  uv run alembic upgrade head
```

Apply to test DB:

```bash
cd backend && AUTH_SECRET_KEY=dev DATABASE_URL=postgresql+psycopg://flowpay:flowpay@localhost:5433/flowpay_test \
  uv run alembic upgrade head
```

### Step 3: Add Wallet Lock API

Modify:

- `wallets/ports/wallet_repository.py`
- `wallets/adapters/wallet_repository.py`
- `wallets/application/wallet_service.py`

Add `lock_by_user_id(user_id)` through the wallet module boundary.

Do not expose wallet adapters to `transfers`.

### Step 4: Implement Transfers Repositories and Service

Create:

- `transfers/adapters/repositories.py`
- `transfers/application/transfer_service.py`

Rules:

- `TransferService` must call `wallet_service.lock_by_user_id(user_id)` before balance reads;
- `SQLAlchemyTransferRepository` must not import `flowpay.wallets.adapters.wallet_orm`;
- no service or repository in this flow may create a new `Session`.

Verification:

```bash
cd backend && AUTH_SECRET_KEY=dev DATABASE_URL=postgresql+psycopg://flowpay:flowpay@localhost:5432/flowpay \
  uv run python -c "from flowpay.transfers.application.transfer_service import TransferService; print('OK')"
```

### Step 5: Wire Composition, Router, and Main

Modify:

- `composition.py`
- `main.py`

Create:

- `transfers/adapters/router.py`

Verification:

```bash
cd backend && AUTH_SECRET_KEY=dev DATABASE_URL=postgresql+psycopg://flowpay:flowpay@localhost:5432/flowpay \
  uv run python -c "from flowpay.main import app; print('OK')"
```

### Step 6: Add Tests

Create:

- `tests/integration/transfers/__init__.py`
- `tests/integration/transfers/test_transfers.py`

Modify:

- `tests/architecture/test_backend_boundaries.py`

Run transfers tests:

```bash
cd backend && AUTH_SECRET_KEY=dev \
  DATABASE_URL_TEST=postgresql+psycopg://flowpay:flowpay@localhost:5433/flowpay_test \
  uv run pytest tests/integration/transfers/ -v
```

Run architecture tests:

```bash
cd backend && AUTH_SECRET_KEY=dev \
  DATABASE_URL_TEST=postgresql+psycopg://flowpay:flowpay@localhost:5433/flowpay_test \
  uv run pytest tests/architecture/ -v
```

Run full suite:

```bash
cd backend && AUTH_SECRET_KEY=dev \
  DATABASE_URL_TEST=postgresql+psycopg://flowpay:flowpay@localhost:5433/flowpay_test \
  uv run pytest tests/ -v
```

Expected: 90+ tests, 0 failures.

---

## Scope

### Implemented

- `POST /transfers` with atomicity, `SELECT ... FOR UPDATE`, idempotency, and API-contract errors.
- `GET /transfers/{id}` scoped to transfer participants only.
- Source wallet lock exposed through `wallets.application.WalletService`.
- One shared SQLAlchemy `Session` across `wallets`, `transfers`, and `ledger` for the transfer use case.
- `transfer_operations` and `idempotency_keys` tables.
- `TransferService` free of FastAPI and SQLAlchemy.
- Idempotency scoped to `user_id`.
- Manual and NFC transfer origins through the same transfer flow.
- Real concurrency test for double-spend prevention.
- Architecture boundary tests for `transfers`.

### Not Implemented

- `GET /nfc/recipient-payload`.
- `POST /nfc/resolve-recipient`.
- Persisted `failed` transfer operations in V1. Failed transfer attempts roll back and do not write balance-affecting ledger rows.
- FK from `ledger_transactions.operation_id` to `transfer_operations.id`.
- Reversals or cancellations.
- Multi-currency support.
- Mock-heavy unit tests for lock behavior.
- New `transfers/domain/` implementation.

---

## Assumptions

- Each user has exactly one wallet.
- The source wallet is derived from the authenticated user, never from the request body.
- The destination wallet is identified by request body `destination_wallet_id`.
- `LedgerService.record_transfer_entries()` writes both debit and credit using the caller's `Session`.
- Idempotency stores the response body returned by `POST /transfers`.
- `JSON` in SQLAlchemy ORM is acceptable, but the migration should explicitly use PostgreSQL `JSONB`.
- Existing test infrastructure can run against the PostgreSQL test database.

---

## Success Criteria

- [ ] `POST /transfers` returns `201` with `{ "transfer": { ... } }`.
- [ ] Source balance decreases and destination balance increases, derived from ledger.
- [ ] Debit and credit share the same `operation_id` and amount.
- [ ] Missing `Idempotency-Key` returns `400 invalid_request`.
- [ ] Same idempotency key + same payload returns the original response.
- [ ] Same idempotency key + same payload does not create a second transfer.
- [ ] Same idempotency key + different payload returns `409 idempotency_key_conflict`.
- [ ] Insufficient balance returns `409 insufficient_balance` and writes no ledger entries.
- [ ] `GET /transfers/{id}` returns `404` for non-participants.
- [ ] Concurrent transfer test produces exactly one success and one failure.
- [ ] Source wallet balance never becomes negative.
- [ ] Architecture tests pass.
- [ ] Full backend test suite passes.

---

## Rollback Plan

Revert code changes:

```bash
git revert HEAD
```

Downgrade development DB:

```bash
cd backend && AUTH_SECRET_KEY=dev DATABASE_URL=postgresql+psycopg://flowpay:flowpay@localhost:5432/flowpay \
  uv run alembic downgrade c87dd4f707cd
```

Downgrade test DB:

```bash
cd backend && AUTH_SECRET_KEY=dev DATABASE_URL=postgresql+psycopg://flowpay:flowpay@localhost:5433/flowpay_test \
  uv run alembic downgrade c87dd4f707cd
```

The downgrade removes only `transfer_operations` and `idempotency_keys`.

---

## Line Estimate

- Runtime code: ~385 lines.
- Migration: ~80 lines.
- Tests and architecture tests: ~275 lines.
- Total added lines: ~740 lines.

Files to create: 8.

- `transfers/adapters/orm.py`
- `transfers/ports/repositories.py`
- `transfers/adapters/repositories.py`
- `transfers/application/transfer_service.py`
- `transfers/adapters/router.py`
- migration file
- `tests/integration/transfers/__init__.py`
- `tests/integration/transfers/test_transfers.py`

Files to modify: 7.

- `wallets/ports/wallet_repository.py`
- `wallets/adapters/wallet_repository.py`
- `wallets/application/wallet_service.py`
- `composition.py`
- `main.py`
- `migrations/env.py`
- `tests/architecture/test_backend_boundaries.py`

---

## Key Risks

1. Accidentally opening a second SQLAlchemy session would break the single-transaction guarantee.
2. Moving wallet locking into `transfers` would violate module ownership.
3. Checking balance before acquiring the wallet lock would reintroduce double-spend risk.
4. Storing idempotency before all writes complete could cache a response for a rolled-back transfer.
5. Testing concurrency through the normal savepoint fixture could produce false confidence.

---

## Final Recommendation

Proceed with the compacted modular design.

It preserves the accepted architecture:

- `wallets` owns wallet locking;
- `transfers` owns transfer orchestration;
- `ledger` owns ledger rows and derived balances;
- one shared database transaction protects the financial path;
- adapters handle HTTP and SQLAlchemy concerns;
- application services remain framework- and database-independent.
