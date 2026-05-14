---
name: fastapi-flowpay
description: FlowPay backend implementation and review skill for FastAPI, Python, PostgreSQL, SQLAlchemy, Alembic, modular monolith boundaries, hexagonal modules, API design, persistence adapters, transactions, and backend implementation plans. Use when Codex works on backend code, endpoint contracts, database models, migrations, repositories, application services, or backend architecture inside FlowPay.
---

# FastAPI FlowPay

## Mission

Build and review FlowPay backend changes using the accepted modular monolith and hexagonal module boundaries. Keep FastAPI, SQLAlchemy, Alembic, and PostgreSQL as infrastructure details around application/domain logic.

## Required Context

Read relevant parts of:

- `docs/adr/0001-backend-architecture.md`
- `docs/adr/0003-stack-selection.md`
- `docs/adr/0004-money-and-ledger-model.md`
- `docs/adr/0005-auth-strategy.md`
- `docs/specs/01-domain-rules.md`
- `docs/specs/02-use-cases.md`
- `docs/specs/03-domain-model.md`

Use `$architecture-advisor` first when the backend change introduces a new boundary, dependency, persistence strategy, transaction model, auth model, or scaling assumption.

## Module Structure

Default backend module layout:

```text
backend/
  app/
    modules/
      auth/
      users/
      wallets/
      ledger/
      transfers/
      nfc/
```

Inside important modules, prefer:

```text
module/
  domain/
  application/
  ports/
  adapters/
```

Rules:

- HTTP routers are adapters.
- SQLAlchemy models and repositories are persistence adapters.
- Pydantic request/response schemas are API boundary objects, not domain models.
- Domain/application code must not import FastAPI, SQLAlchemy sessions, request objects, or HTTP response types.
- Simpler modules may have fewer files, but must keep dependency direction clear.

## Backend Workflow

1. Identify the use case and owning module.
2. Locate the domain invariant being protected.
3. Define or update domain/application behavior before HTTP and persistence details.
4. Add ports when application logic needs infrastructure behavior.
5. Implement adapters for FastAPI, SQLAlchemy, auth, or external systems.
6. Add or update Alembic migrations for schema changes.
7. Add tests using `$testing-flowpay`; use PostgreSQL-backed integration tests for money movement.
8. Review security-sensitive logic with `$security-ledger-flowpay` when auth, ledger, transfers, idempotency, or authorization are involved.

## FastAPI Guardrails

- Keep routers thin: parse request, call application use case, map response/error.
- Do not put financial rules in routers, dependencies, SQLAlchemy models, or Pydantic schemas.
- Derive `current_user_id` from validated auth token for protected operations.
- Never accept source wallet authority from the client for outgoing transfers.
- Return stable API errors that do not leak passwords, tokens, internals, or private wallet details.
- Keep OpenAPI-friendly schemas, but do not let generated docs drive domain design.

## SQLAlchemy and PostgreSQL Guardrails

- Keep ORM models separate from domain models.
- Centralize session/transaction management.
- Money-moving writes must run in one database transaction.
- Use PostgreSQL locking around the source wallet or equivalent consistency boundary before balance validation.
- Use integer amounts for `COP`; never use floats.
- Preserve append-only transaction records.
- Use unique constraints for identities, one wallet per user, welcome bonus once per wallet, and idempotency keys.
- Alembic migrations must preserve module data ownership even when the database is shared.

## Output Checklist

Before finishing backend work, state:

- owning module;
- use case supported;
- invariants protected;
- transaction/idempotency behavior when relevant;
- tests added or still needed;
- any ADR/research note that should be created.
