# API Contract

## Purpose

This document defines FlowPay's initial backend API contract. It describes endpoints, authentication requirements, request/response shapes, idempotency behavior, and error responses.

It does not define database tables or implementation details.

## General Rules

- All request and response bodies use JSON.
- All authenticated endpoints require `Authorization: Bearer <access_token>`.
- Money amounts are positive integers in Colombian pesos (`COP`).
- The client never sends the authoritative source wallet for outgoing transfers.
- The backend derives the source wallet from the authenticated user.
- Transfer creation requires an `Idempotency-Key` header.
- NFC only resolves or prepares a recipient; it does not execute money movement directly.

## Error Shape

All error responses should use this shape:

```json
{
  "error": {
    "code": "string",
    "message": "string"
  }
}
```

Example:

```json
{
  "error": {
    "code": "insufficient_balance",
    "message": "The source wallet does not have enough available balance."
  }
}
```

## Auth

### POST /auth/register

Creates a user, creates their wallet, and grants the welcome bonus.

Auth: public.

Request:

```json
{
  "username": "alice",
  "password": "strong-password"
}
```

Response `201 Created`:

```json
{
  "user": {
    "id": "usr_123",
    "username": "alice"
  },
  "wallet": {
    "id": "wal_123",
    "currency": "COP",
    "balance": 50000
  }
}
```

Errors:

- `400 invalid_request`
- `409 username_already_exists`

Rules:

- Passwords are never returned.
- A new wallet receives exactly one welcome bonus.
- The returned balance is derived from recorded transactions.

### POST /auth/login

Authenticates a user and returns an access token.

Auth: public.

Request:

```json
{
  "username": "alice",
  "password": "strong-password"
}
```

Response `200 OK`:

```json
{
  "access_token": "jwt-or-token",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "id": "usr_123",
    "username": "alice"
  }
}
```

Errors:

- `400 invalid_request`
- `401 invalid_credentials`

Rules:

- Passwords are never returned.
- Tokens must not contain wallet balance or private financial data.

### GET /auth/me

Returns the authenticated user summary.

Auth: required.

Response `200 OK`:

```json
{
  "user": {
    "id": "usr_123",
    "username": "alice"
  }
}
```

Errors:

- `401 unauthenticated`

## Wallet

### GET /wallet

Returns the authenticated user's wallet summary.

Auth: required.

Response `200 OK`:

```json
{
  "wallet": {
    "id": "wal_123",
    "currency": "COP",
    "balance": 45000
  }
}
```

Errors:

- `401 unauthenticated`
- `404 wallet_not_found`

Rules:

- The wallet is derived from the authenticated user.
- The balance is derived from ledger transactions.

### GET /wallet/transactions

Returns the authenticated user's wallet transaction history.

Auth: required.

Query parameters:

- `limit`: optional integer, default `50`.
- `cursor`: optional pagination cursor.

Response `200 OK`:

```json
{
  "transactions": [
    {
      "id": "txn_123",
      "type": "debit",
      "amount": 5000,
      "currency": "COP",
      "source": "manual_transfer",
      "operation_id": "op_123",
      "counterparty": {
        "wallet_id": "wal_456",
        "username": "bob"
      },
      "created_at": "2026-05-14T10:30:00Z"
    }
  ],
  "next_cursor": null
}
```

Errors:

- `401 unauthenticated`
- `404 wallet_not_found`

Rules:

- The user only sees transactions for their own wallet.
- The history must include credits and debits from welcome bonuses, manual transfers, and NFC transfers.
- Transactions are ordered from newest to oldest.

## Transfers

### POST /transfers

Creates a transfer from the authenticated user's wallet to another wallet.

Auth: required.

Headers:

```text
Idempotency-Key: <client-generated-unique-key>
```

Request:

```json
{
  "destination_wallet_id": "wal_456",
  "amount": 5000,
  "origin": "manual_transfer"
}
```

Allowed `origin` values:

- `manual_transfer`
- `nfc_transfer`

Response `201 Created`:

```json
{
  "transfer": {
    "id": "op_123",
    "source_wallet_id": "wal_123",
    "destination_wallet_id": "wal_456",
    "amount": 5000,
    "currency": "COP",
    "origin": "manual_transfer",
    "status": "completed",
    "created_at": "2026-05-14T10:30:00Z",
    "completed_at": "2026-05-14T10:30:00Z"
  }
}
```

Errors:

- `400 invalid_request`
- `400 invalid_amount`
- `400 same_wallet_transfer`
- `401 unauthenticated`
- `404 destination_wallet_not_found`
- `409 insufficient_balance`
- `409 idempotency_key_conflict`

Rules:

- The client must not send `source_wallet_id`.
- The backend derives the source wallet from the authenticated user.
- The transfer must be atomic.
- A completed transfer creates exactly one debit and one credit.
- The same `Idempotency-Key` and same payload returns the original result.
- The same `Idempotency-Key` with a different payload is rejected.
- NFC-origin transfers use the same endpoint and rules as manual transfers.

### GET /transfers/{transfer_id}

Returns a transfer operation visible to the authenticated user.

Auth: required.

Response `200 OK`:

```json
{
  "transfer": {
    "id": "op_123",
    "source_wallet_id": "wal_123",
    "destination_wallet_id": "wal_456",
    "amount": 5000,
    "currency": "COP",
    "origin": "manual_transfer",
    "status": "completed",
    "created_at": "2026-05-14T10:30:00Z",
    "completed_at": "2026-05-14T10:30:00Z"
  }
}
```

Errors:

- `401 unauthenticated`
- `404 transfer_not_found`

Rules:

- A user can view a transfer only if their wallet is the source or destination.

## NFC

### GET /nfc/recipient-payload

Returns a payload that can be exposed by the receiver for NFC-assisted transfer initiation.

Auth: required.

Response `200 OK`:

```json
{
  "payload": {
    "type": "flowpay_recipient",
    "wallet_id": "wal_123",
    "display_name": "alice"
  }
}
```

Errors:

- `401 unauthenticated`
- `404 wallet_not_found`

Rules:

- The payload must not include passwords, tokens, balances, or private financial data.
- The payload identifies or prepares the recipient only.
- The payload does not authorize a transfer.

### POST /nfc/resolve-recipient

Resolves an NFC payload into recipient data that can be reviewed before transfer confirmation.

Auth: required.

Request:

```json
{
  "payload": {
    "type": "flowpay_recipient",
    "wallet_id": "wal_456"
  }
}
```

Response `200 OK`:

```json
{
  "recipient": {
    "wallet_id": "wal_456",
    "username": "bob",
    "display_name": "bob"
  }
}
```

Errors:

- `400 invalid_nfc_payload`
- `401 unauthenticated`
- `404 recipient_wallet_not_found`

Rules:

- Resolving an NFC recipient does not move money.
- The sender must still enter an amount and confirm the transfer.
- Transfer execution happens through `POST /transfers` with `origin: "nfc_transfer"`.

## Status Codes

Common status code usage:

- `200 OK`: successful read or login.
- `201 Created`: successful resource creation.
- `400 Bad Request`: malformed or invalid request.
- `401 Unauthorized`: missing or invalid authentication.
- `404 Not Found`: resource not found or not visible to the user.
- `409 Conflict`: business conflict such as insufficient balance or idempotency conflict.

## Fields The Client Must Not Control

The client must not control:

- source wallet for transfers;
- transaction IDs;
- transfer operation IDs;
- transaction type;
- transaction status;
- transaction source;
- wallet balance;
- welcome bonus amount;
- transaction timestamps;
- ledger entries.

These values are owned by the backend.
