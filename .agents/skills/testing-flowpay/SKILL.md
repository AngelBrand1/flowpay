---
name: testing-flowpay
description: FlowPay testing skill for domain tests, FastAPI tests, PostgreSQL-backed integration tests, SQLAlchemy/Alembic validation, React Native tests, NFC parser tests, idempotency tests, concurrency tests, and regression coverage for financial invariants. Use when Codex designs, implements, reviews, or explains tests for FlowPay.
---

# Testing FlowPay

## Mission

Protect FlowPay's financial and auth invariants with focused tests. Prefer tests that prove behavior at the correct boundary instead of broad tests that only exercise framework plumbing.

## Required Context

Read relevant parts of:

- `docs/specs/01-domain-rules.md`
- `docs/specs/02-use-cases.md`
- `docs/specs/03-domain-model.md`
- `docs/adr/0003-stack-selection.md`
- `docs/adr/0004-money-and-ledger-model.md`
- `docs/adr/0005-auth-strategy.md`

Use `$security-ledger-flowpay` for test design around money movement, idempotency, auth, authorization, token handling, or concurrent transfers.

## Test Strategy

Use the smallest test scope that can prove the behavior:

- Domain tests for pure rules and value objects.
- Application tests for use-case orchestration and port behavior.
- PostgreSQL-backed integration tests for transfers, locking, idempotency, constraints, and migrations.
- FastAPI route tests for request/response mapping, auth enforcement, and error contracts.
- React Native tests for flow state, UI behavior, API adapters, secure storage wrappers, and NFC payload parsing.
- Manual Android device validation for real NFC behavior.

## Required Financial Coverage

For money movement, cover:

- amount must be positive integer `COP`;
- no floats;
- source wallet is derived from authenticated user;
- destination wallet must exist;
- source and destination must differ;
- insufficient balance rejects without writes;
- completed transfer creates exactly one debit and one credit;
- debit and credit have same amount and operation reference;
- failed transfer writes no balance-affecting transactions;
- transfer creation is idempotent;
- same idempotency key with different payload is rejected;
- concurrent transfers cannot double spend;
- NFC-origin transfers follow the same ledger rules as manual transfers.

## Auth Coverage

Cover:

- duplicate username rejection;
- password hash storage, never plain text;
- invalid credentials rejection;
- protected endpoints require token;
- token identifies `current_user_id`;
- users can read only their own wallet data;
- users can transfer only from their own wallet;
- logs and errors do not expose tokens or passwords.

## Mobile Coverage

Cover:

- token storage through secure storage wrapper;
- missing/expired token returns to auth flow;
- balance/history refresh after transfer;
- manual fallback when NFC is unavailable;
- NFC payload parse success/failure;
- transfer confirmation requires recipient and amount;
- UI does not treat cached balance as authority.

## Test Design Rules

- Test domain invariants directly when possible.
- Use PostgreSQL, not SQLite, for tests involving locks, transactions, constraints, or concurrent money movement.
- Make idempotency and concurrency tests deterministic where practical.
- Prefer factories/builders over duplicating setup noise.
- Avoid mocking the database for behavior that depends on database semantics.
- Keep tests readable enough to serve as executable specs for financial behavior.

## Output Checklist

Before finishing testing work, state:

- invariant or use case covered;
- test level used and why;
- database/runtime assumptions;
- gaps that require integration, device, or manual validation.
