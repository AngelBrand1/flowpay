# ADR 0005: Auth Strategy

## Status

Accepted

## Context

FlowPay needs authentication to protect wallet access and money-moving operations.

The first version should keep auth simple, but it must not weaken transfer security. The backend must always know which user is authenticated and must derive the source wallet from that identity.

Auth should also remain extractable in the future if FlowPay grows into multiple products or requires a dedicated identity service.

## Decision

FlowPay will use username/password authentication with token-based API access for the first version.

The backend will:

- register users with a unique username and password;
- hash passwords before storage;
- issue an access token after successful login;
- validate the access token on protected requests;
- derive `current_user_id` from the validated token;
- derive the source wallet from `current_user_id`.

The mobile app will:

- collect username and password for login;
- store the access token in secure storage;
- send the token on authenticated API requests;
- clear the token on logout.

## Password Storage

Passwords must never be stored in plain text.

The first implementation should use a modern password hashing algorithm such as Argon2id or bcrypt.

Password hashing must be owned by the `auth` module.

Other modules must not know how passwords are stored or verified.

## Token Model

The first version will use JWT access tokens signed with HS256.

JWT is selected over opaque tokens because it requires no server-side token storage and validation is stateless — the backend only needs the signing secret. For a beta without active revocation, this simplicity tradeoff is acceptable.

The signing secret must be loaded from environment configuration (`AUTH_SECRET_KEY`). It must never be committed to the repository or hardcoded in source code.

Token expiry is set to **1 hour** (`exp = iat + 3600`). This matches the `expires_in: 3600` value in the API contract.

The token must contain only:

- `sub`: authenticated user identifier;
- `iat`: issued-at timestamp;
- `exp`: expiration timestamp.

The token must not contain:

- password data;
- wallet balance;
- permissions inferred from client state;
- private profile data not needed for authentication.

## Refresh Tokens

Refresh tokens are out of scope for the first version.

Reasoning:

- They add storage, rotation, revocation, and theft-handling concerns.
- The product does not need long-lived sessions to validate the core wallet and NFC flows.
- A shorter-lived access token keeps the first implementation smaller.

If session duration becomes a product issue, refresh tokens can be added later as an auth module extension.

## Authorization Rules

Authentication identifies the user. Authorization still happens server-side per operation.

Rules:

- Protected endpoints require a valid access token.
- The backend derives the source wallet from the authenticated user.
- The client cannot choose the source wallet for outgoing transfers.
- A user can view only their own wallet balance and transaction history.
- A user can transfer only from their own wallet.
- Destination wallets may be referenced by public recipient identifiers or validated wallet identifiers, but they must be resolved server-side.

## Mobile Storage

The mobile app must store the access token using secure storage.

The token must not be stored in plain async storage or other unprotected local storage.

If the token is missing, expired, or invalid, the app must require login again.

## Module Boundary

The `auth` module owns:

- credential registration;
- password hashing;
- password verification;
- token issuing;
- token validation.

Other modules should depend on a stable authenticated identity, not auth internals.

Example boundary:

```text
auth -> returns current_user_id
transfers -> uses current_user_id to derive source wallet
wallets -> uses current_user_id to read owned wallet
```

This keeps auth extractable later.

## Out of Scope

The first version does not support:

- OAuth;
- OpenID Connect;
- social login;
- multi-factor authentication;
- refresh tokens;
- roles and permissions beyond authenticated user ownership;
- account recovery;
- device management;
- admin users.

## Consequences

### Positive

- Simple enough for the first version.
- Protects wallet ownership and transfer source selection.
- Keeps auth separate from financial modules.
- Preserves a future path to extract auth into a service.
- Avoids storing passwords insecurely.

### Negative

- Users must log in again when the access token expires.
- No refresh token means less seamless long-lived sessions.
- No account recovery or MFA in the first version.
- Token invalidation before expiration is limited unless server-side token tracking is added.

## Guardrails

- Passwords must never be stored or logged in plain text.
- Password verification must happen only inside the `auth` module.
- JWT tokens must be signed with HS256 using a secret loaded from `AUTH_SECRET_KEY` environment variable.
- The `AUTH_SECRET_KEY` must never be committed to the repository or hardcoded in source code.
- Access tokens must be validated server-side on every protected request.
- Token expiry is 1 hour; expired tokens must be rejected.
- The backend must derive `current_user_id` from the validated token `sub` claim.
- The backend must derive source wallet ownership from `current_user_id`.
- Mobile token storage must use secure storage.
- Logs must not include tokens or passwords.
- Financial modules must not depend on auth persistence details.

## Future Evolution

Auth may evolve later to support:

- refresh tokens;
- token revocation;
- OAuth/OIDC;
- MFA;
- device sessions;
- dedicated auth service extraction;
- shared identity across multiple products.

Extraction should be possible by replacing the in-process auth adapter with a remote identity provider while preserving the `current_user_id` contract.

