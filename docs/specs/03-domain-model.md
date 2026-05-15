# Domain Model

## Purpose

This document defines FlowPay’s conceptual model. It describes entities, relationships, and minimum domain data without yet imposing a specific database structure or endpoints.

## Base Decisions

- A wallet’s balance is derived from its transactions.
- Money is represented as an integer value in Colombian pesos (`COP`).
- The first version handles only Colombian pesos (`COP`).
- The welcome bonus is an auditable transaction.
- A transfer is represented as an operation that groups two transactions: debit and credit.
- NFC does not create a separate financial system; it only initiates or prepares a transfer.

## Entities

### User

Represents a person registered in FlowPay.

Conceptual fields:

- `id`: unique user identifier.
- `username`: unique identity used for authentication.
- `password_hash`: secure representation of the password.
- `created_at`: creation date and time.

Relationships:

- A user has one wallet.

Rules:

- `username` must be unique.
- The password is never stored in plain text.

### Wallet

Represents a user’s value container.

Conceptual fields:

- `id`: unique wallet identifier.
- `user_id`: user who owns the wallet.
- `currency`: wallet’s currency, fixed to `COP` in the first version.
- `created_at`: creation date and time.

Relationships:

- A wallet belongs to one user.
- A wallet has many transactions.

Rules:

- A wallet belongs to a single user.
- A wallet does not store balance as the source of truth.
- The available balance is calculated from its transactions.

### Transaction

Represents an auditable movement that affects a wallet.

Conceptual fields:

- `id`: unique transaction identifier.
- `wallet_id`: affected wallet.
- `type`: transaction type.
- `amount`: positive integer value in Colombian pesos (`COP`).
- `source`: movement source.
- `operation_id`: operation reference, when applicable.
- `counterparty_wallet_id`: counterparty wallet, when applicable.
- `created_at`: registration date and time.

Initial types:

- `credit`
- `debit`

Initial sources:

- `welcome_bonus` — one-time credit on wallet creation; no operation reference.
- `manual_transfer` — credit or debit from a manual transfer; requires operation reference.
- `nfc_transfer` — credit or debit from an NFC-assisted transfer; requires operation reference.
- `topup` — simulated credit added by the user directly; no operation reference; may be recorded multiple times per wallet.

Rules:

- `amount` is always positive.
- `type` determines if the movement increases or decreases the balance.
- `source` explains why the movement exists.
- A recorded transaction is not modified.
- Every transaction must be able to appear in the affected wallet’s history.
- Sources that require an operation reference: `manual_transfer`, `nfc_transfer`.
- Sources that must not have an operation reference: `welcome_bonus`, `topup`.

### TransferOperation

Represents a transfer operation between two wallets.

Conceptual fields:

- `id`: unique operation identifier.
- `source_wallet_id`: wallet sending money.
- `destination_wallet_id`: wallet receiving money.
- `amount`: transferred integer value in Colombian pesos (`COP`).
- `origin`: channel for initiating the transfer.
- `status`: operation status.
- `created_at`: creation date and time.
- `completed_at`: completion date and time, when applicable.

Initial statuses:

- `completed`
- `failed`

Rules:

- Source and destination must be different wallets.
- A completed transfer has exactly two associated transactions:
  - `debit` in the source wallet.
  - `credit` in the destination wallet.
- Both transactions have the same `operation_id`.
- Both transactions have the same `amount`.
- A failed transfer must not record transactions that affect balance.

### NfcTransferIntent

Represents the intent or payload used to initiate an NFC-assisted transfer.

Conceptual fields:

- `id`: unique intent identifier.
- `destination_wallet_id`: wallet that will receive the money.
- `display_name`: visible name of the receiver for confirmation.
- `expires_at`: expiration date and time, if a temporary payload is used.
- `created_at`: creation date and time.

Rules:

- An NFC intent does not move money.
- An NFC intent only identifies or prepares the receiver.
- The sender must confirm receiver and amount before executing a transfer.
- If the intent is invalid or expired, it cannot be used to initiate the transfer.
- Initial support is Android-first and only for compatible devices.

Note:

The first implementation may use a public wallet identifier instead of persisting an `NfcTransferIntent` entity, as long as the same confirmation and auditability rules are maintained.

## Relationships

```text
User 1 ── 1 Wallet
Wallet 1 ── * Transaction
TransferOperation 1 ── 2 Transaction
NfcTransferIntent 0..1 ── 1 Wallet
```

Interpretation:

- Each user has one wallet.
- Each wallet has a history of transactions.
- Each completed transfer groups two transactions.
- An NFC intent points to the wallet that will receive money, but does not affect balance.

## Balance Calculation

A wallet’s available balance is calculated as follows:

```text
balance =
  sum(transaction.amount where type = credit)
  - sum(transaction.amount where type = debit)
```

Rules:

- The calculated balance must not be negative.
- Balance is not modified directly.
- The history must allow reconstructing the balance.

## Operation Examples

### Create Wallet

Conceptual result:

- A `User` is created.
- A `Wallet` is created.
- A `Transaction` of type `credit` with source `welcome_bonus` is created.

### Top-Up

Conceptual result:

- A `Transaction` of type `credit` with source `topup` is created for the user's wallet.
- No `TransferOperation` is created.
- No counterparty is involved.

### Manual Transfer

Conceptual result:

- A `TransferOperation` with origin `manual_transfer` is created.
- A `Transaction` of type `debit` and source `manual_transfer` for the source wallet is created.
- A `Transaction` of type `credit` and source `manual_transfer` for the destination wallet is created.

### NFC-Assisted Transfer

Conceptual result:

- NFC identifies or prepares the destination wallet.
- The sender confirms amount and receiver.
- A `TransferOperation` with origin `nfc_transfer` is created.
- A `Transaction` of type `debit` and source `nfc_transfer` for the source wallet is created.
- A `Transaction` of type `credit` and source `nfc_transfer` for the destination wallet is created.

## Model Invariants

- No transaction uses negative values.
- No wallet can end up with a negative balance.
- A completed transfer always has a debit and a credit.
- The debit and credit of a transfer always have the same value.
- NFC cannot record transactions outside of a confirmed transfer.
- The welcome bonus can only be recorded once per wallet.
- A top-up can be recorded multiple times per wallet; there is no per-wallet uniqueness constraint.
- Top-up amount must be between 1 and 1,000,000 COP per operation.
