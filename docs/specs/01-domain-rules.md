# Domain Rules

## Purpose

This document defines FlowPay’s initial business rules. It does not describe architecture, database, endpoints, or framework. Its goal is to fix the expected domain behavior before implementation.

## Main Concepts

### User

Represents a person who can use FlowPay.

Rules:

- A user must have a unique identity within the system.
- A user must authenticate with username and password in the first version.
- A user may have a wallet.

### Wallet

Represents a user’s value container within FlowPay.

Rules:

- Each wallet belongs to a single user.
- A wallet handles Colombian pesos (`COP`) in the first version.
- A wallet’s available balance is derived from its recorded transactions.
- A wallet cannot have a negative balance.

### Transaction

Represents an auditable change in a wallet.

Rules:

- Every balance change must be backed by one or more transactions.
- A recorded transaction must not be modified.
- A transaction must have, at minimum:
  - unique identifier;
  - affected wallet;
  - transaction type;
  - amount;
  - date and time;
  - source;
  - operation reference, when applicable.
- A transaction amount must be positive.
- The transaction type determines whether the movement increases or decreases the balance.
- The transaction source explains why the movement exists.

### Welcome Bonus

Represents an automatic initial balance granted when a wallet is created.

Rules:

- A welcome bonus increases the wallet’s available balance.
- A welcome bonus is granted by the system, not requested by the user.
- A welcome bonus must create an auditable transaction.
- The welcome bonus amount must be greater than zero.
- A wallet must not receive more than one welcome bonus.
- The first version does not connect to banks, cards, PSE, Stripe, or real cash-in providers.

### Transfer

Represents sending money from a source wallet to a destination wallet.

Rules:

- A transfer always involves two distinct wallets.
- The source wallet must have sufficient balance before executing the transfer.
- A valid transfer must create:
  - a debit transaction in the source wallet;
  - a credit transaction in the destination wallet.
- Both transactions must have the same amount and share the same operation reference.
- A transfer must not be partially applied.
- A transfer with an amount less than or equal to zero must be rejected.
- A transfer to the same wallet must be rejected.

## Transaction Type and Source

Initial types:

- `credit`: money inflow.
- `debit`: money outflow.

Initial sources:

- `welcome_bonus`: automatic initial balance granted when a wallet is created.
- `manual_transfer`: transfer initiated manually.
- `nfc_transfer`: transfer initiated through the NFC beta flow.

Rules:

- `credit` increases the wallet balance.
- `debit` decreases the wallet balance.
- `welcome_bonus` transactions must be `credit`.
- `manual_transfer` and `nfc_transfer` transactions can be `debit` or `credit`.
- There must be no orphan transfer transactions: every transfer `debit` must have a corresponding transfer `credit` with the same amount and operation reference.

## Balance

A wallet’s available balance is calculated from its transactions.

Conceptual formula:

```text
balance = sum(credit) - sum(debit)
```

Rules:

- Balance must not be updated as an isolated value without an associated transaction.
- Calculated balance must never be negative.
- Money precision must avoid floating-point errors.
- The first version handles only Colombian pesos (`COP`).

## Supported Operations

The first version supports:

- Creating user and wallet.
- Authenticating with username and password.
- Granting an automatic welcome bonus when a wallet is created.
- Sending money directly to another wallet.
- Initiating a transfer through an NFC-assisted Android beta flow when supported.
- Checking available balance.
- Viewing transaction history.

The first version does not support:

- Payment requests.
- User-initiated balance loading.
- Transfer cancellations.
- Transfer rejections.
- Transfer expirations.
- Reversals.
- Currencies other than Colombian pesos (`COP`).
- Integrations with external financial systems.

## NFC-Assisted Transfers

NFC is a beta initiation method for face-to-face transfers on supported Android devices. It does not create a separate payment system.

Rules:

- NFC may identify or prepare the destination wallet for a transfer.
- The NFC flow is available only when the required device capabilities are present.
- The sender must explicitly confirm the recipient and amount before money moves.
- The transfer must use the same validation, balance, transaction, and auditability rules as a manual transfer.
- A transfer initiated through NFC must record NFC as the operation origin and transaction source.
- NFC must not allow automatic payments without user confirmation.
- The first version assumes NFC is used with trusted contacts.
- iOS is not supported in the first NFC version.

## Invariants

These rules must always hold:

- No wallet can have a negative balance.
- Every balance change must have auditable transactions.
- A transfer cannot create or destroy money.
- The amount debited from the source wallet must equal the amount credited to the destination wallet.
- A transfer must be applied fully or not at all.
- Recorded transactions must not be modified.
- The transaction history must allow reconstructing a wallet’s balance.

## Error Cases

The system must reject:

- Creating a user with a duplicate identity.
- Authenticating with invalid credentials.
- Transferring an amount less than or equal to zero.
- Transferring from a non-existent wallet.
- Transferring to a non-existent wallet.
- Transferring to the same wallet.
- Transferring more money than the available balance.

## Auditability

The history must allow answering:

- Which wallet was affected.
- What type of transaction occurred.
- How much money moved.
- When it happened.
- What source created the transaction.
- Which transactions belong to the same operation.

For transfers, history must show the movement from each participant’s perspective:

- The sender sees a money outflow to the receiver.
- The receiver sees a money inflow from the sender.
