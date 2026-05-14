# Testing Strategy

## Purpose

This document defines FlowPay's first-version testing strategy.

The goal is to protect the financial core while keeping the test suite practical for a small product. FlowPay uses a risk-based test pyramid: use the smallest test scope that proves the behavior, and use real infrastructure only when correctness depends on real infrastructure semantics.

## Testing Principles

- Money movement receives the highest test priority.
- Domain and application rules should be testable without HTTP.
- PostgreSQL-backed integration tests are required for transfer behavior because mocks, fakes, and SQLite cannot prove PostgreSQL transaction, lock, constraint, and idempotency behavior.
- NFC hardware behavior can be validated manually, but NFC payload parsing and flow orchestration must be automated.
- Tests should enforce architecture boundaries where practical.
- API tests should prove HTTP contracts, auth, dependency wiring, and error mapping; they should not duplicate every domain rule already covered at lower layers.
- End-to-end tests are intentionally limited in V1. They are useful as smoke tests, not as the primary protection for ledger correctness.
- Test data must be isolated. Tests must not rely on execution order or preexisting database rows.

## Test Layers

### Unit Tests

Scope:

- domain models;
- value validation;
- application use cases with fake ports;
- ID generation utility;
- NFC payload parsing;
- auth token creation/validation helpers where practical.

Must cover:

- positive money amount validation;
- COP-only behavior;
- same-wallet transfer rejection;
- welcome bonus amount;
- welcome bonus created once per wallet;
- credit/debit invariants;
- welcome bonus is represented as a credit with source `welcome_bonus`;
- NFC payload does not authorize money movement.

### Integration Tests

Scope:

- FastAPI endpoint behavior;
- SQLAlchemy persistence adapters;
- PostgreSQL transactions;
- transfer creation;
- idempotency storage;
- database constraints;
- migration application;
- ledger history reads.

Must use:

- PostgreSQL, not SQLite, for money movement tests.

PostgreSQL may run through a local Docker Compose service, Testcontainers, or another isolated test database. The requirement is real PostgreSQL semantics, not a specific harness.

Must cover:

- user registration creates user, wallet, and welcome bonus;
- login returns a valid token;
- protected endpoints reject missing/invalid tokens;
- wallet balance is derived from ledger transactions;
- manual transfer creates exactly one debit and one credit with source `manual_transfer`;
- NFC-origin transfer creates exactly one debit and one credit with source `nfc_transfer`;
- NFC-origin transfer uses the same transfer path as manual transfer;
- insufficient balance rejects transfer without ledger writes;
- same-wallet transfer is rejected;
- invalid amount is rejected;
- duplicate idempotency key with same payload returns original response;
- duplicate idempotency key with different payload is rejected;
- transaction history includes counterparty data;
- `SELECT ... FOR UPDATE` prevents concurrent double spend.

### API Contract Tests

Scope:

- response shapes;
- error shape;
- status codes;
- auth requirements;
- idempotency header behavior.

Must cover:

- errors use `{ "error": { "code": "...", "message": "..." } }`;
- transfer creation requires `Idempotency-Key`;
- client cannot send `source_wallet_id`;
- NFC resolve does not create a transfer;
- NFC transfer execution happens through `POST /transfers`.

### Architecture Boundary Tests

The first version should include lightweight architecture checks where practical.

Targets:

- domain modules must not import FastAPI;
- domain modules must not import SQLAlchemy;
- domain modules must not import NFC libraries;
- mobile domain code must not import React hooks;
- mobile NFC infrastructure must not call transfer API directly unless through application flow.

These checks may be implemented with import-linter, custom tests, or simple static checks.

### Mobile Tests

Automated:

- application flow tests for transfer confirmation;
- NFC payload parsing tests;
- manual fallback flow when NFC is unavailable;
- auth token storage wrapper behavior with mocks;
- API client error handling.

Manual/device validation:

- Android NFC capability detection;
- reading or presenting the supported NFC payload;
- full NFC-assisted transfer flow on supported Android hardware;
- fallback behavior on unsupported devices.

### Concurrency Tests

At least one PostgreSQL-backed test must simulate concurrent transfers from the same source wallet.

Expected result:

- only transfers covered by available balance succeed;
- no wallet balance becomes negative;
- failed transfer attempts do not create partial debit/credit records.

This test validates the `SELECT ... FOR UPDATE` decision.

## Idempotency Tests

Transfer creation is a money-moving operation and must be tested as an externally visible API contract, not only as a persistence detail.

Must cover:

- missing `Idempotency-Key` is rejected for `POST /transfers`;
- same authenticated user, same key, same payload returns the original result;
- same authenticated user, same key, different payload is rejected;
- keys are scoped to the authenticated user;
- manual and NFC-origin transfers follow the same idempotency rules;
- retry after an unknown client-side network result cannot create a second completed transfer.

## Auth and Authorization Tests

Must cover:

- duplicate username is rejected;
- password is stored as a hash, never plain text;
- invalid credentials are rejected;
- protected endpoints reject missing, invalid, or expired tokens;
- token validation yields `current_user_id`;
- wallet balance/history endpoints only expose the authenticated user's wallet;
- transfer source wallet is derived from the authenticated user, not from client input;
- logs and error responses do not expose passwords or tokens.

## Test Data

Defaults:

- welcome bonus: COP 50,000;
- currency: `COP`;
- IDs use prefixed UUID format.

Test data must not rely on hardcoded database row ordering.

Database-backed tests should create the records they need and clean up through transaction rollback, database truncation, or disposable database instances. Tests should be able to run independently.

## CI Quality Gate

The default CI gate should run:

- formatting and static checks, when configured;
- backend unit tests;
- backend architecture boundary tests;
- PostgreSQL-backed backend integration tests;
- API contract tests;
- mobile unit and flow tests, when the mobile project is present.

The NFC device gate is manual for V1 and must be recorded in the release checklist or implementation notes when hardware is unavailable.

## Out of Scope for V1

The first test strategy does not require:

- full end-to-end cloud deployment tests;
- automated real NFC hardware tests in CI;
- performance/load testing;
- refresh token tests;
- multi-currency tests;
- reversal tests;
- external money-provider sandbox tests;
- broad browser-style end-to-end coverage across every user journey.

## Minimum Quality Gate Before Delivery

Before considering the first implementation ready:

- unit tests for domain/application pass;
- PostgreSQL-backed integration tests for transfers pass;
- idempotency tests pass;
- concurrency double-spend test passes;
- API contract tests pass for core endpoints;
- auth and authorization tests pass for protected wallet and transfer behavior;
- migration application has been validated against PostgreSQL;
- architecture boundary checks pass;
- Android NFC flow has been manually validated or explicitly documented as blocked by device availability.
