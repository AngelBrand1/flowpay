# Domain Model

## Purpose

This document defines FlowPay’s conceptual model. It describes entities, relationships, and minimum domain data without yet imposing a specific database structure or endpoints.

## Base Decisions

- A wallet’s balance is derived from its transactions.
- Money is represented as an integer value in the currency’s smallest unit.
- The first version handles a single currency.
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
- `currency`: wallet’s currency.
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
- `amount`: positive value in currency’s smallest unit.
- `origin`: movement origin.
- `operation_id`: operation reference, when applicable.
- `counterparty_wallet_id`: counterparty wallet, when applicable.
- `created_at`: registration date and time.

Initial types:

- `welcome_bonus`
- `transfer_debit`
- `transfer_credit`

Initial origins:

- `system`
- `manual_transfer`
- `nfc_transfer`

Rules:

- `amount` is always positive.
- The type determines if the movement increases or decreases the balance.
- A recorded transaction is not modified.
- Every transaction must be able to appear in the affected wallet’s history.

### TransferOperation

Represents a transfer operation between two wallets.

Conceptual fields:

- `id`: unique operation identifier.
- `source_wallet_id`: wallet sending money.
- `destination_wallet_id`: wallet receiving money.
- `amount`: transferred value in currency’s smallest unit.
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
  - `transfer_debit` in the source wallet.
  - `transfer_credit` in the destination wallet.
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
  sum(transaction.amount where type = welcome_bonus)
  + sum(transaction.amount where type = transfer_credit)
  - sum(transaction.amount where type = transfer_debit)
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
- A `Transaction` of type `welcome_bonus` with origin `system` is created.

### Manual Transfer

Conceptual result:

- A `TransferOperation` with origin `manual_transfer` is created.
- A `Transaction` of type `transfer_debit` for the source wallet is created.
- A `Transaction` of type `transfer_credit` for the destination wallet is created.

### NFC-Assisted Transfer

Conceptual result:

- NFC identifies or prepares the destination wallet.
- The sender confirms amount and receiver.
- A `TransferOperation` with origin `nfc_transfer` is created.
- The same two transactions as in a manual transfer are created.

## Model Invariants

- No transaction uses negative values.
- No wallet can end up with a negative balance.
- A completed transfer always has a debit and a credit.
- The debit and credit of a transfer always have the same value.
- NFC cannot record transactions outside of a confirmed transfer.
- The welcome bonus can only be recorded once per wallet.


