# ADR 0004: Money and Ledger Model

## Status

Accepted

## Context

FlowPay moves money-like balances between user wallets. The product must prevent lost funds, duplicated transfers, unauthorized debits, and inconsistent histories.

Several domain documents already imply the ledger model. This ADR consolidates the implementation-level decision because money movement is the most security-critical part of the system.

Related documents:

- `docs/specs/01-domain-rules.md`
- `docs/specs/03-domain-model.md`
- `docs/adr/0001-backend-architecture.md`
- `docs/adr/0003-stack-selection.md`

## Decision

FlowPay will use an append-only ledger model with derived balances.

The backend will represent money as integers in Colombian pesos (`COP`).

A completed transfer will be represented by:

- one `TransferOperation`;
- one `debit` transaction in the source wallet;
- one `credit` transaction in the destination wallet.

The welcome bonus will be represented as a `credit` transaction with source `welcome_bonus` when a wallet is created. The welcome bonus amount is fixed at **COP 50,000** for the first version. This value is hardcoded in the domain, not in configuration, so that it is subject to domain-level tests. Changing the amount requires a code change and a migration decision.

A top-up will be represented as a `credit` transaction with source `topup`. It is a unilateral credit with no counterparty and no operation reference. It may be recorded multiple times per wallet. The maximum amount per top-up is **COP 1,000,000**, validated in the application service.

Recorded transactions are immutable.

## Money Representation

Money amounts must not use floating-point values.

Amounts will be represented as positive integers.

Examples:

```text
COP 50000 -> 50000
```

The first version supports only Colombian pesos (`COP`). Multi-currency support is out of scope.

## Balance Calculation

Wallet balance is derived from ledger transactions:

```text
balance =
  sum(credit)
  - sum(debit)
```

The balance is not the financial source of truth as an isolated mutable field.

If a cached balance is introduced later for performance, it must be treated as a derived projection and protected by consistency checks.

## Transfer Execution

Transfer execution must happen inside one database transaction.

The operation must:

1. derive the source wallet from the authenticated user;
2. validate the destination wallet;
3. validate amount is positive;
4. validate source and destination are different;
5. lock the source wallet row with `SELECT ... FOR UPDATE`;
6. calculate available balance;
7. validate sufficient balance;
8. create the `TransferOperation`;
9. create the debit transaction;
10. create the credit transaction;
11. commit all writes together.

If any step fails, the transfer must not affect wallet balances.

## Concurrency Control

FlowPay will use PostgreSQL `SELECT ... FOR UPDATE` on the source wallet row to prevent double spending.

The transfer use case must acquire an exclusive row lock on the source wallet before reading its balance or writing transfer transactions. No other concurrent transfer can proceed against the same wallet until the lock is released at transaction commit or rollback.

This is the simplest correct strategy at beta scale. It requires that the wallet row exists and is accessible within the same database transaction as the debit and credit writes.

## Idempotency

Money-moving requests must be idempotent.

Transfer creation must require an idempotency key.

Rules:

- The same idempotency key with the same payload returns the original result.
- The same idempotency key with a different payload is rejected.
- Idempotency keys are scoped to the authenticated user.
- Idempotency applies to both manual and NFC-initiated transfers.

This protects against double taps, mobile retries, network timeouts, and repeated NFC submissions.

## NFC Implication

NFC does not change the ledger model. There is no backend NFC module; NFC payload parsing and recipient resolution live entirely in the mobile adapter layer.

When the mobile app resolves a recipient via NFC it calls `POST /transfers` with `destination_username` and `origin: "nfc_transfer"` — the same endpoint used by the manual flow. The backend processes both identically.

The only difference between transfer origins is the recorded source value:

- `manual_transfer`
- `nfc_transfer`

Source taxonomy summary:

| source | type | operation_id | per-wallet limit |
|---|---|---|---|
| `welcome_bonus` | credit only | must be null | once |
| `topup` | credit only | must be null | unlimited |
| `manual_transfer` | credit or debit | required | unlimited |
| `nfc_transfer` | credit or debit | required | unlimited |

The `transfers` module always handles money movement regardless of origin. NFC never writes ledger transactions directly.

## Transaction History Read Model

The transaction history endpoint must return a `counterparty` field with `wallet_id` and `username` for transfer transactions.

`ledger` owns transaction records. `username` lives in `users`. To resolve this without breaking module ownership:

- The `ledger` persistence adapter may execute a read-only join against the `users` table when constructing the transaction history response.
- This join is allowed in the first version because both modules share the same database.
- The join must happen only inside the `ledger` persistence adapter, not in the domain or application layers.
- If `users` and `ledger` are ever separated into different databases, this join must be replaced with a `users` read model or a dedicated query service.

This is an explicitly permitted read-side cross-module access, not a dependency on `users` internals.

## Reversals

The first version does not support reversals.

If reversals are added later, they must be represented with new compensating transactions. Existing transactions must not be edited or deleted.

## Invariants

These invariants must always hold:

- Transaction amounts are positive integers.
- Recorded transactions are immutable.
- A wallet cannot have a negative balance.
- A completed transfer has exactly one debit and one credit.
- Transfer debit and credit have the same amount.
- Transfer debit and credit share the same operation reference.
- The welcome bonus transaction is a `credit` with source `welcome_bonus`.
- A top-up transaction is a `credit` with source `topup`; amount between 1 and 1,000,000 COP.
- A failed transfer does not write balance-affecting transactions.
- The welcome bonus can be recorded only once per wallet.
- A top-up can be recorded multiple times per wallet.
- NFC-origin transfers follow the same ledger rules as manual transfers.

## Consequences

### Positive

- Preserves an auditable money history.
- Allows balance reconstruction.
- Reduces risk of silent balance corruption.
- Provides a clear transfer invariant for tests.
- Gives the backend a single financial source of truth.
- Keeps NFC from becoming a parallel payment system.

### Negative

- Balance reads require aggregation or a derived projection.
- Transfer implementation is more careful than direct balance updates.
- Concurrency and idempotency must be tested explicitly.
- Future reversals require compensating-entry design instead of mutating old records.

## Guardrails

- Domain logic must not accept negative money amounts.
- Domain logic must not use floats for money.
- The client must not send or calculate authoritative source balances.
- The backend must derive the source wallet from authentication.
- Transfer creation must be idempotent.
- Debit and credit writes must be in the same database transaction.
- Transfer execution must acquire `SELECT ... FOR UPDATE` on the source wallet row before reading balance.
- The welcome bonus amount is COP 50,000 and must be validated in domain-level tests.
- The welcome bonus must be created exactly once per wallet; a second welcome bonus for the same wallet must be rejected.
- Top-up amount must be between 1 and 1,000,000 COP; this rule lives in the application service.
- Top-up transactions must not carry an operation reference or counterparty.
- Ledger transactions must only be created through approved application use cases.
- Persistence adapters may optimize reads, but they must not bypass ledger invariants.
- The `counterparty` join in transaction history is permitted only inside the `ledger` persistence adapter.

## References

- PostgreSQL Explicit Locking: https://www.postgresql.org/docs/current/static/explicit-locking.html
- PostgreSQL Transaction Isolation: https://www.postgresql.org/docs/current/transaction-iso.html
- Stripe Idempotent Requests: https://docs.stripe.com/api/idempotent_requests
- Formance Ledger: https://docs.formance.com/modules/ledger
- Medici: https://github.com/flash-oss/medici
