# ADR 0003: Stack Selection

## Status

Accepted

## Context

FlowPay needs a stack that supports:

- a modular monolith backend;
- hexagonal module boundaries;
- PostgreSQL-backed transactional consistency;
- append-only financial transaction records;
- Android-first mobile development;
- NFC-assisted transfer initiation;
- fast delivery without creating a throwaway architecture.

Related decisions:

- `docs/adr/0001-backend-architecture.md`
- `docs/adr/0002-mobile-architecture.md`

## Decision

FlowPay will use the following first-version stack:

- Backend: FastAPI + Python.
- Database: PostgreSQL.
- Persistence: SQLAlchemy 2.x (sync) with `psycopg` v3 driver.
- Migrations: Alembic.
- Mobile: React Native with Expo tooling, custom development builds, and a committed Android native project for NFC.
- NFC: `react-native-nfc-manager`.
- Auth: username/password with JWT access tokens (HS256).
- Testing: pytest with PostgreSQL-backed integration tests.
- ID Generation: UUID v4 with resource-type prefix per entity type.

## Rationale

### Backend: FastAPI + Python

FastAPI gives FlowPay a lightweight backend foundation with:

- fast API development;
- request validation and serialization through Pydantic;
- automatic OpenAPI documentation;
- good compatibility with SQLAlchemy and Alembic;
- enough flexibility to enforce module boundaries explicitly.

FastAPI does not impose a heavy framework architecture. This is useful because FlowPay already defines its backend architecture as a modular monolith with hexagonal module boundaries.

### Database: PostgreSQL

PostgreSQL is selected because FlowPay needs strong transactional guarantees for money-like transfers.

Required capabilities:

- ACID transactions;
- row-level locking;
- uniqueness constraints;
- reliable relational queries;
- transactional debit and credit writes;
- balance reconstruction from transaction records.

SQLite, MongoDB, and in-memory storage are not appropriate as the main product database for concurrent money-like transfers.

### Persistence: SQLAlchemy 2.x (sync)

SQLAlchemy 2.x in sync mode with `psycopg` v3 is selected for the first version.

Financial integrity does not come from sync I/O itself. It comes from PostgreSQL transactions, `SELECT ... FOR UPDATE`, idempotency, constraints, and tests.

Sync SQLAlchemy is preferred because it reduces implementation risk in the financial core:

- transaction boundaries are explicit and easy to read;
- the debit + credit + commit sequence is written as direct sequential code;
- there is no risk of mixing sync database calls into `async def` routes;
- there is no risk of forgotten `await` on database operations;
- the first version does not need high-concurrency async I/O to validate product value.

`psycopg` v3 is selected over `psycopg2` because it is the modern PostgreSQL driver for Python and is supported by SQLAlchemy through the `postgresql+psycopg://` dialect.

FastAPI handles sync route handlers by running them in a threadpool. This is acceptable for the first version because transfer operations are short and protected by database transactions.

Session lifecycle must be managed per-request through FastAPI dependency injection using a `yield`-based dependency. Sessions must not be shared across requests or held open outside the request scope.

ORM models must remain inside persistence adapters. They must not become domain models.

### Migrations: Alembic

Alembic is selected as the migration tool because it is the standard migration companion for SQLAlchemy and supports controlled schema evolution.

Database migrations should respect module ownership. A shared database does not mean shared data ownership.

### Mobile: React Native with Expo Prebuild / Development Builds

React Native keeps the mobile app close to the React development model while allowing native mobile capabilities.

Expo tooling is selected to move faster, but FlowPay will keep the Android native project in git so custom NFC code stays explicit and reviewable.

Expo Go is not sufficient for FlowPay because NFC requires native libraries and Android configuration.

### NFC: `react-native-nfc-manager`

`react-native-nfc-manager` is selected as the initial NFC library because it provides React Native NFC primitives and supports Android use cases relevant to the beta feature.

NFC is implemented entirely in the mobile adapter layer (`mobile/src/modules/nfc/`). The backend has no NFC module. NFC resolves a recipient username on-device and passes it to `POST /transfers` as `destination_username` — the same field used by manual transfers. The backend never distinguishes an NFC-initiated transfer from a manual one, and no NFC-specific endpoint, service, or migration exists.

### Auth: Username/Password + JWT (HS256)

The first version uses username/password authentication with JWT access tokens signed with HS256.

JWT is selected over opaque tokens because:

- No server-side token storage is required for the first version.
- Validation is stateless: the backend only needs the signing secret.
- For a beta without token revocation, the simplicity tradeoff is acceptable.

Token payload is minimal: `sub` (user ID), `iat`, `exp`. The signing secret must be loaded from environment configuration and must never be committed to the repository.

See `docs/adr/0005-auth-strategy.md` for full auth decision.

### ID Generation

All resource identifiers use UUID v4 with a resource-type prefix:

- Users: `usr_<uuid4>`
- Wallets: `wal_<uuid4>`
- Transactions: `txn_<uuid4>`
- Transfer operations: `op_<uuid4>`

A shared utility function `generate_id(prefix: str) -> str` must be implemented once in a `shared` module and used by all persistence adapters. This avoids scattered ID generation logic and makes IDs identifiable in logs and debug output.

### Testing: pytest + PostgreSQL Integration Tests

Testing must focus on the financial core.

The first version should include:

- domain/application unit tests;
- transfer integration tests using PostgreSQL;
- idempotency tests;
- insufficient balance tests;
- concurrent transfer tests where practical;
- NFC payload parsing tests without requiring hardware;
- manual Android device validation for real NFC behavior.

## Alternatives Considered

### NestJS + TypeScript

Not selected for the first version.

NestJS has strong modules, dependency injection, and TypeScript consistency with React Native. It remains a valid alternative.

FastAPI is preferred because it is lighter, faster to scaffold for this project, and gives more direct control over the explicit hexagonal module structure.

### Spring Boot

Not selected for the first version.

Spring Boot has excellent maturity for long-lived backend systems and transaction management, but it adds more ceremony than needed for FlowPay's initial scope.

### Go

Not selected for the first version.

Go offers simple deployment and strong performance, but it would require more manual architecture scaffolding and slower product iteration for this project.

### SQLite

Not selected as the product database.

SQLite is useful for local prototypes, but PostgreSQL is a better fit for concurrent transfer validation, row-level locking, and production-like transaction behavior.

### MongoDB / NoSQL

Not selected.

FlowPay's core model is relational and transaction-heavy. PostgreSQL better supports the required financial invariants.

### Expo Go

Not selected as the mobile development runtime for NFC.

Expo Go cannot include arbitrary native modules or native Android configuration required by the NFC feature.

### React Native CLI

Not selected as the default starting point.

React Native CLI provides maximum native control, but Expo prebuild/development builds provide enough native access with faster iteration.

## Consequences

### Positive

- Supports fast API and mobile development.
- Preserves strong PostgreSQL transactional guarantees.
- Fits the modular monolith and hexagonal backend architecture.
- Keeps ORM details behind persistence adapters.
- Enables Android NFC through native-capable React Native tooling.
- Keeps a future path to iOS.
- Provides a practical testing path for the financial core.

### Negative

- FastAPI does not enforce module boundaries automatically.
- Sync SQLAlchemy route handlers run in a threadpool; at high I/O concurrency this is less resource-efficient than async I/O.
- Python backend and TypeScript mobile introduce two language ecosystems.
- NFC requires custom development builds and real Android device validation.
- Committed Android native code requires discipline to keep generated and manual changes aligned.

## Guardrails

- Backend module boundaries must be enforced by project structure and tests.
- Domain models must not depend on SQLAlchemy models.
- SQLAlchemy must be used in sync mode with `psycopg` v3.
- Database URLs must use the `postgresql+psycopg://` dialect.
- DB-backed FastAPI route handlers should be sync `def`, not `async def`.
- `Session` must be scoped to the request lifecycle via FastAPI `yield` dependency injection.
- Sessions must not be shared across requests or background tasks.
- PostgreSQL must be used for integration tests that validate money movement.
- Transfer creation must be idempotent.
- NFC code must remain behind a mobile infrastructure adapter.
- Expo Go must not be used as the NFC validation environment.
- Auth token storage on mobile must use secure storage.
- Financial state shown on mobile must be refreshed from the backend after transfers.
- JWT signing secret must be loaded from environment configuration and never committed to the repository.
- All resource IDs must be generated using the shared `generate_id(prefix)` utility.

## Future Reconsideration

This decision should be revisited if:

- the backend grows enough to require stronger framework-level dependency injection;
- the team standardizes on TypeScript end to end;
- auth needs justify adopting an external identity provider;
- NFC requirements require custom native Android code beyond what `react-native-nfc-manager` supports;
- operational scale justifies extracting modules or changing deployment topology.

## References

- FastAPI Features: https://fastapi.tiangolo.com/features/
- SQLAlchemy Transactions: https://docs.sqlalchemy.org/en/21/orm/session_transaction.html
- Alembic Documentation: https://alembic.sqlalchemy.org/
- PostgreSQL Explicit Locking: https://www.postgresql.org/docs/current/static/explicit-locking.html
- Expo custom native code: https://docs.expo.dev/workflow/customizing/
- `react-native-nfc-manager`: https://github.com/revtel/react-native-nfc-manager
