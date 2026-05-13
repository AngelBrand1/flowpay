# Use Cases

## Purpose

This document describes FlowPay’s main behaviors from the product perspective. It does not define screens, endpoints, or database structure.

The use cases must be verifiable and serve as a bridge between domain rules and implementation.

## UC-01 Create Wallet

### Actor

User.

### Goal

Create a user account with an associated wallet to operate within FlowPay.

### Preconditions

- No user exists with the same identity.

### Main Flow

1. The user provides their minimum registration data.
2. The system validates that the identity is unique.
3. The system creates the user.
4. The system creates a wallet associated with the user.
5. The system records an automatic welcome bonus for the wallet.
6. The wallet’s initial balance is derived from the recorded welcome bonus.

### Errors

- If the identity already exists, the system rejects the creation.
- If required data is missing, the system rejects the creation.

### Acceptance Criteria

- A created user has exactly one wallet.
- A new wallet receives exactly one welcome bonus.
- The initial balance of a new wallet matches the recorded welcome bonus.
- No two users can exist with the same identity.

## UC-02 Authenticate

### Actor

User.

### Goal

Log into FlowPay to operate with their wallet.

### Preconditions

- The user exists.

### Main Flow

1. The user enters username and password.
2. The system validates the credentials.
3. The system allows the user to operate with their wallet.

### Errors

- If credentials are invalid, the system rejects access.
- If the user does not exist, the system rejects access.

### Acceptance Criteria

- A user with valid credentials can access the system.
- A user with invalid credentials cannot access the system.
- An authenticated user only operates on their own wallet as the source of funds.

## UC-03 Check Balance

### Actor

Authenticated user.

### Goal

Check the available balance of their wallet.

### Preconditions

- The user is authenticated.
- The user has a wallet.

### Main Flow

1. The user requests their balance.
2. The system calculates the balance from recorded transactions.
3. The system displays the available balance.

### Errors

- If the wallet does not exist, the system cannot display a balance.

### Acceptance Criteria

- The displayed balance matches the recorded transactions.
- The balance is never negative.
- The balance does not depend on isolated updates without an associated transaction.

## UC-04 Transfer Money Manually

### Actor

Authenticated user.

### Goal

Send money from their wallet to another person’s wallet.

### Preconditions

- The sender is authenticated.
- The source wallet exists.
- The destination wallet exists.
- The source wallet has sufficient balance.

### Main Flow

1. The sender selects or specifies the destination wallet.
2. The sender specifies the amount to transfer.
3. The system validates that the amount is greater than zero.
4. The system validates that source and destination are different wallets.
5. The system validates sufficient balance in the source wallet.
6. The system records a debit in the source wallet.
7. The system records a credit in the destination wallet.
8. Both transactions are associated with the same operation reference.
9. The system confirms the transfer.

### Errors

- If the amount is less than or equal to zero, the system rejects the transfer.
- If the destination wallet does not exist, the system rejects the transfer.
- If the sender attempts to transfer to themselves, the system rejects the transfer.
- If the balance is insufficient, the system rejects the transfer.
- If both transactions cannot be recorded, the transfer must not be applied.

### Acceptance Criteria

- A valid transfer generates exactly one debit and one credit.
- The debit and the credit have the same amount.
- The debit and the credit share the same operation reference.
- The transfer does not create, lose, or duplicate money.
- A failed transfer does not modify balances.

## UC-05 Transfer Money with NFC Beta

### Actor

Authenticated user on a compatible Android device.

### Goal

Initiate a face-to-face transfer using NFC to reduce friction in identifying the receiver.

### Preconditions

- The sender is authenticated.
- The sender’s device supports the required NFC flow.
- The receiver can present a supported NFC identifier.
- The source wallet exists.
- The destination wallet exists.

### Main Flow

1. The receiver presents their NFC identifier.
2. The sender scans the identifier from FlowPay.
3. The system obtains the destination wallet from the NFC payload.
4. The system shows the receiver’s information to the sender for review.
5. The sender specifies the amount to transfer.
6. The sender explicitly confirms the transfer.
7. The system executes the transfer using the same rules as the manual flow.
8. The system records the origin of the operation as NFC.
9. The system confirms the transfer.

### Errors

- If the device does not support the required NFC flow, the system does not offer NFC.
- If the NFC payload is invalid, the system rejects the transfer initiation.
- If the destination wallet does not exist, the system rejects the transfer.
- If the sender does not explicitly confirm, no money moves.
- If any manual transfer validation fails, the NFC transfer is rejected.

### Acceptance Criteria

- NFC only initiates or prepares the transfer; it does not move money automatically.
- The sender always sees the receiver before confirming.
- The sender always explicitly confirms before moving money.
- An NFC-initiated transfer satisfies the same invariants as a manual transfer.
- The history allows identifying that the operation was initiated by NFC.

## UC-06 View Transaction History

### Actor

Authenticated user.

### Goal

View the transactions that explain their wallet balance.

### Preconditions

- The user is authenticated.
- The user has a wallet.

### Main Flow

1. The user requests their history.
2. The system retrieves the wallet’s transactions.
3. The system displays the transactions ordered from most recent to oldest.

### Errors

- If the wallet does not exist, the system cannot display history.

### Acceptance Criteria

- The history shows welcome bonuses, debits, and credits.
- Each transaction displays date, time, amount, type, and origin.
- For transfers, the sender sees an outflow and the receiver sees an inflow.
- The history allows reconstructing the wallet balance.
