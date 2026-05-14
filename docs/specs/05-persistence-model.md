# Persistence Model

## Purpose

This document translates FlowPay's domain model into an initial PostgreSQL persistence model.

It defines tables, ownership, constraints, indexes, and transaction-related persistence rules. It does not define ORM classes or migration file names.

## General Decisions

- PostgreSQL is the product database.
- SQLAlchemy 2.x sync with `psycopg` v3 is the persistence stack.
- Alembic owns schema migrations.
- IDs are UUID v4 strings with resource prefixes.
- Money amounts are positive integers in Colombian pesos (`COP`).
- The database is shared in the first version, but table ownership is module-based.
- Financial records are append-only.
- Transfer execution uses `SELECT ... FOR UPDATE` on the source wallet row.

## Table Ownership

| Table | Owner Module |
| --- | --- |
| `users` | `users` |
| `auth_credentials` | `auth` |
| `wallets` | `wallets` |
| `transfer_operations` | `transfers` |
| `ledger_transactions` | `ledger` |
| `idempotency_keys` | `transfers` |

Rules:

- Modules must not mutate tables owned by another module directly.
- Read-side joins are allowed only when explicitly documented.
- The transaction history counterparty join is allowed inside the `ledger` persistence adapter.

## `users`

Stores user identity data that is not credential-specific.

Columns:

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | text | primary key, prefix `usr_` |
| `username` | text | not null, unique |
| `created_at` | timestamptz | not null |

Indexes:

- unique index on `username`.

## `auth_credentials`

Stores credential material owned by the `auth` module.

Columns:

| Column | Type | Constraints |
| --- | --- | --- |
| `user_id` | text | primary key, references `users(id)` |
| `password_hash` | text | not null |
| `created_at` | timestamptz | not null |
| `updated_at` | timestamptz | not null |

Rules:

- Plain-text passwords must never be stored.
- Password hashes must never be returned by API responses.

## `wallets`

Stores wallet identity and ownership.

Columns:

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | text | primary key, prefix `wal_` |
| `user_id` | text | not null, unique, references `users(id)` |
| `currency` | text | not null, fixed to `COP` |
| `created_at` | timestamptz | not null |

Indexes:

- unique index on `user_id`.

Rules:

- Each user has exactly one wallet.
- The wallet row is the locking boundary for transfers.
- Transfer execution must lock the source wallet row with `SELECT ... FOR UPDATE`.

## `transfer_operations`

Stores transfer operation metadata.

Columns:

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | text | primary key, prefix `op_` |
| `source_wallet_id` | text | not null, references `wallets(id)` |
| `destination_wallet_id` | text | not null, references `wallets(id)` |
| `amount` | bigint | not null, greater than `0` |
| `currency` | text | not null, fixed to `COP` |
| `origin` | text | not null |
| `status` | text | not null |
| `created_at` | timestamptz | not null |
| `completed_at` | timestamptz | nullable |

Allowed `origin` values:

- `manual_transfer`
- `nfc_transfer`

Allowed `status` values:

- `completed`
- `failed`

Constraints:

- `amount > 0`
- `source_wallet_id <> destination_wallet_id`
- `currency = 'COP'`

Indexes:

- index on `source_wallet_id`.
- index on `destination_wallet_id`.
- index on `created_at`.

## `ledger_transactions`

Stores append-only wallet-affecting transactions.

Columns:

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | text | primary key, prefix `txn_` |
| `wallet_id` | text | not null, references `wallets(id)` |
| `type` | text | not null |
| `amount` | bigint | not null, greater than `0` |
| `currency` | text | not null, fixed to `COP` |
| `source` | text | not null |
| `operation_id` | text | nullable, references `transfer_operations(id)` |
| `counterparty_wallet_id` | text | nullable, references `wallets(id)` |
| `created_at` | timestamptz | not null |

Allowed `type` values:

- `credit`
- `debit`

Allowed `source` values:

- `welcome_bonus`
- `manual_transfer`
- `nfc_transfer`

Allowed `type` / `source` combinations:

| Type | Allowed Source |
| --- | --- |
| `credit` | `welcome_bonus`, `manual_transfer`, `nfc_transfer` |
| `debit` | `manual_transfer`, `nfc_transfer` |

Constraints:

- `amount > 0`
- `currency = 'COP'`
- `type` and `source` must match the allowed combinations above
- rows with source `welcome_bonus` must be type `credit`
- rows with source `welcome_bonus` must not have `operation_id`
- rows with source `manual_transfer` or `nfc_transfer` must have `operation_id`
- one `welcome_bonus` source transaction per wallet

Indexes:

- index on `wallet_id, created_at desc`.
- index on `operation_id`.
- unique partial index for one `source = 'welcome_bonus'` transaction per `wallet_id`.

Append-only rule:

- Application code must not update or delete `ledger_transactions`.
- Future reversals must be represented by compensating transactions.

## `idempotency_keys`

Stores idempotency state for money-moving operations.

Columns:

| Column | Type | Constraints |
| --- | --- | --- |
| `id` | text | primary key |
| `user_id` | text | not null, references `users(id)` |
| `key` | text | not null |
| `request_hash` | text | not null |
| `response_status` | integer | not null |
| `response_body` | jsonb | not null |
| `created_at` | timestamptz | not null |

Constraints:

- unique index on `user_id, key`.

Rules:

- The same `user_id` and `key` with the same request hash returns the stored response.
- The same `user_id` and `key` with a different request hash is rejected.
- Idempotency applies to both manual and NFC-origin transfer creation.

## Transfer Write Transaction

Transfer creation must run in one database transaction:

1. Resolve authenticated user.
2. Resolve and lock source wallet row with `SELECT ... FOR UPDATE`.
3. Resolve destination wallet.
4. Check idempotency key.
5. Calculate source wallet balance from `ledger_transactions`.
6. Validate sufficient balance.
7. Insert `transfer_operations`.
8. Insert source wallet `debit`.
9. Insert destination wallet `credit`.
10. Store idempotency result.
11. Commit.

If any step fails, the database transaction must roll back.

## Balance Query

Initial balance calculation:

```sql
sum(case
  when type = 'credit' then amount
  when type = 'debit' then -amount
end)
```

Rules:

- Balance is derived from ledger transactions.
- A cached balance table is out of scope for the first version.
- If added later, cached balances are projections, not the source of truth.

## Transaction History Read Model

The wallet history query may join:

- `ledger_transactions`
- `wallets`
- `users`

Purpose:

- return transaction rows with counterparty username.

Rule:

- This join is read-only and belongs inside the `ledger` persistence adapter.
- Domain and application layers must not depend on joined persistence models.
