---
name: security-ledger-flowpay
description: FlowPay security and ledger safety skill for money movement, append-only transactions, derived balances, idempotency, PostgreSQL locking, authorization, token handling, password hashing, secure mobile storage, NFC safety, and financial invariant review. Use when Codex implements or reviews transfer, wallet, ledger, auth, NFC, or security-sensitive behavior.
---

# Security Ledger FlowPay

## Mission

Protect FlowPay from lost money, duplicated money, unauthorized debits, inconsistent histories, credential leaks, and unsafe NFC shortcuts. Treat ledger and auth behavior as security-critical even in the beta.

## Required Context

Read relevant parts of:

- `docs/specs/01-domain-rules.md`
- `docs/specs/03-domain-model.md`
- `docs/adr/0004-money-and-ledger-model.md`
- `docs/adr/0005-auth-strategy.md`
- `docs/research/03-transaction-security.md`
- `docs/adr/0001-backend-architecture.md`
- `docs/adr/0002-mobile-architecture.md`

Use `$architecture-advisor` first when changing ledger model, auth model, transaction boundaries, idempotency semantics, token lifetime strategy, or NFC security assumptions.

## Ledger Rules

- Money amounts are positive integers in `COP`.
- Never use floating-point values for money.
- Balance is derived from immutable transactions.
- Recorded transactions are append-only.
- A completed transfer has exactly one debit and one credit.
- Debit and credit share amount and operation reference.
- Failed transfers write no balance-affecting transactions.
- Welcome bonus can be recorded only once per wallet.
- Reversals, if added later, must use compensating transactions rather than edits/deletes.

## Transfer Safety Workflow

For each transfer implementation or review, verify:

1. Source wallet is derived from authenticated user.
2. Destination is resolved server-side.
3. Amount is positive integer `COP`.
4. Source and destination are different.
5. Source wallet or equivalent consistency boundary is locked.
6. Balance is calculated after locking.
7. Sufficient balance is validated.
8. `TransferOperation`, debit, and credit are written in one database transaction.
9. Idempotency key is required and scoped to authenticated user.
10. Same key and same payload returns original result.
11. Same key and different payload is rejected.

## Auth Rules

- Passwords are never stored, logged, returned, or compared in plain text.
- Use a modern password hash such as Argon2id or bcrypt.
- Access tokens contain only minimum identity data.
- Validate token server-side on every protected request.
- Derive `current_user_id` from the token.
- Financial modules depend on authenticated identity, not auth persistence internals.
- Mobile token storage uses secure storage.
- Logs and errors must not expose tokens, passwords, hashes, or private wallet details.

## NFC Rules

- NFC can identify or prepare a recipient only.
- NFC never moves money directly.
- NFC never bypasses recipient review, amount entry, or explicit confirmation.
- NFC-origin transfers use the same backend transfer use case and ledger invariants as manual transfers.
- Invalid, expired, unsupported, or failed NFC flows fall back to manual transfer path.

## Review Checklist

Flag the change if it:

- lets the client choose authoritative source wallet;
- updates balance directly as source of truth;
- writes debit and credit outside one transaction;
- calculates balance before the required lock;
- omits idempotency for money-moving requests;
- edits/deletes ledger transactions;
- uses floats for money;
- logs secrets or credentials;
- stores mobile tokens in unprotected storage;
- lets NFC execute transfer without explicit confirmation.

## Output Standard

For security/ledger reviews, lead with findings:

```markdown
**Findings**
- [Severity] [file:line] Issue and impact.

**Required Fix**
[Concrete fix.]

**Residual Risk**
[What remains unproven or needs testing.]
```
