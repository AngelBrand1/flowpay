# ADR 0001: Backend Architecture

## Status

Accepted

## Context

FlowPay handles money-like transfers between user wallets. Even though the first version is intentionally small, the architecture must protect financial integrity and leave room for future product growth.

The backend must support:

- user authentication;
- wallet ownership;
- welcome bonus creation;
- balance calculation;
- manual transfers;
- NFC-assisted transfer initiation;
- auditable transaction history.

The main architectural risks are:

- losing or duplicating money;
- creating partial transfers;
- allowing unauthorized wallet access;
- coupling NFC directly to financial writes;
- building a throwaway demo architecture that becomes hard to evolve;
- introducing distributed complexity before it is needed.

## Decision

FlowPay will use a modular monolith backend with a consistent hexagonal architecture per module.

The first version will keep:

- one deployable backend;
- one primary transactional database boundary;
- explicit internal modules;
- dependency direction pointing inward toward domain/application logic;
- adapters at the edges for HTTP, persistence, NFC, and external integrations.

Initial backend modules:

- `auth`
- `users`
- `wallets`
- `ledger`
- `transfers`

Each module should follow the same conceptual structure:

```text
module/
  domain/
  application/
  ports/
  adapters/
```

The structure may vary in depth depending on module complexity, but not in dependency direction.

The `ledger` and `transfers` modules are security-critical and must apply the architecture strictly. Simpler modules may contain fewer files, but should preserve the same boundaries.

## Module Boundary Policy

Each module owns its domain behavior and data access.

Modules may expose behavior through application-level contracts, but other modules must not depend on their internal implementation details.

Allowed cross-module interaction:

- calling another module's public application service;
- depending on an explicit port/interface;
- using stable identifiers such as `user_id`, `wallet_id`, or `operation_id`;
- consuming read models or DTOs explicitly exposed for that purpose.

Disallowed cross-module interaction:

- importing another module's internal domain objects directly;
- calling another module's repositories directly;
- querying or mutating another module's database tables directly;
- bypassing application services to reuse internal helper functions;
- sharing persistence models as domain models across modules.

Read/query adapters may use cross-module SQL joins only to build denormalized
read responses in the shared database monolith. These joins are not part of
domain or application decision-making, must not mutate foreign module data, and
must not enforce financial rules. If a cross-module read starts carrying
business logic, write behavior, or extraction pressure, it should move behind an
explicit query/read-model contract.

Initial data ownership:

- `auth` owns credentials, password hashing, and authentication state.
- `users` owns user profile data.
- `wallets` owns wallet identity and ownership.
- `ledger` owns transaction records and balance reconstruction.
- `transfers` owns transfer orchestration and transfer operation state.

NFC payload parsing, recipient resolution, and device capability concerns live entirely in the mobile adapter layer (`mobile/src/modules/nfc/`). The backend has no NFC module because NFC is an input channel: the mobile app resolves a recipient username via NFC and then calls the existing `POST /transfers` endpoint with `destination_username`. The backend never distinguishes an NFC-initiated transfer from a manual one.

Shared database usage is allowed in the first version, but table ownership must remain clear. A shared database does not mean shared data ownership.

## Future Extraction Policy

Modules should be designed so they can be extracted later, but they should not be deployed as separate services until there is a concrete reason.

Valid reasons to extract a module:

- independent scaling needs;
- independent deployment needs;
- separate team ownership;
- reuse by multiple products;
- different security or compliance requirements;
- integration complexity that no longer belongs inside the main backend.

Likely extraction candidates:

- `auth`, if identity becomes shared across products or requires dedicated security capabilities;
- read-heavy reporting or analytics modules, if they are added later.

Modules that should not be extracted early:

- `ledger`;
- `transfers`.

These modules form the financial core. Extracting them too early would introduce distributed consistency problems in the most sensitive part of the system.

The preferred evolution path is:

1. Start in-process with strict module boundaries.
2. Replace direct in-process calls with explicit ports where useful.
3. Add remote adapters only when extraction is justified.
4. Keep contracts stable while changing the deployment topology.
5. Extract peripheral modules before financial core modules.

## Rationale

### Financial Integrity

Money movement benefits from a single transactional boundary in the first version.

A modular monolith allows debit and credit records to be written inside one backend operation and one database transaction. This reduces the risk of partial transfers and avoids distributed transaction complexity.

### Evolvability

The project should not be a throwaway demo. Internal modules create clear boundaries that can evolve independently and may later be extracted if there is real scale, team, or operational need.

Starting with microservices would add infrastructure and consistency problems before the product proves those needs.

### Domain Protection

Hexagonal architecture protects business rules from external mechanisms:

- HTTP controllers should not contain financial rules.
- Database repositories should not decide transfer validity.
- NFC should not write ledger records directly.
- The mobile app should not calculate authoritative balances.

The domain and application layers define what the system does. Adapters translate external inputs and infrastructure details.

### NFC Boundary

NFC is a transfer initiation channel, not a financial subsystem.

NFC payload parsing, device capability checks, and recipient resolution are handled entirely in the mobile adapter layer. The backend has no NFC module. The mobile app resolves the recipient via NFC and calls `POST /transfers` with `destination_username` — the same endpoint used by manual transfers. Actual money movement always goes through the `transfers` module and ledger rules regardless of how the recipient was selected.

## Alternatives Considered

### Traditional Layered Monolith

Rejected as the primary architecture.

It is fast to scaffold, but tends to spread business features across generic folders such as controllers, services, repositories, and models. For FlowPay, this makes it easier for financial rules to leak into framework or persistence code.

### Full Microservices From Day One

Rejected for the first version.

Microservices would provide deployable boundaries, but they would also introduce distributed transactions, network failure modes, service observability, retries, and deployment complexity too early.

For a money-transfer product, premature distribution increases risk in the core path.

### Event-Driven Core

Rejected for the initial money movement path.

Events may be useful later for notifications, analytics, audit exports, or other non-critical side effects. The first version should keep transfer execution synchronous and transactional.

### Pure Vertical Slice Architecture

Rejected as the top-level architecture.

Use-case-oriented organization is useful, but financial invariants should not be scattered across independent slices. FlowPay needs a central ledger and transfer boundary.

Vertical slices may still influence application services inside modules.

## Consequences

### Positive

- Keeps the first version deployable as one backend.
- Preserves one transactional boundary for money movement.
- Makes the financial core easier to test.
- Protects domain logic from framework, database, and NFC details.
- Creates module boundaries for future evolution.
- Avoids premature microservice overhead.

### Negative

- Requires discipline to avoid cross-module coupling.
- Adds more structure than a simple layered demo.
- Does not provide independent module deployment.
- Requires architectural guardrails to prevent decay into a tangled monolith.

## Guardrails

- `ledger` owns transaction records.
- `transfers` owns transfer orchestration.
- All money movement, regardless of initiation channel, must go through the same transfer application use case.
- NFC recipient resolution belongs to the mobile adapter layer; the backend has no NFC module.
- HTTP adapters call application use cases; they do not implement business rules.
- Persistence adapters store and retrieve data; they do not decide financial validity.
- The backend derives the source wallet from the authenticated user.
- Money-moving operations require idempotency.
- Debit and credit writes must be protected by a database transaction.
- The mobile app never calculates authoritative balance.
- Domain/application code must not depend on HTTP frameworks, database clients, or NFC libraries.

## Future Evolution

If FlowPay grows, the modular monolith can evolve gradually:

1. Keep modules in one backend while enforcing boundaries.
2. Add asynchronous events only for side effects.
3. Extract non-core modules first if needed.
4. Keep ledger and transfer integrity centralized until there is a mature distributed consistency strategy.
5. Consider a dedicated ledger service only if operational scale or team ownership justifies it.

## References

- Martin Fowler, Monolith First: https://martinfowler.com/bliki/MonolithFirst.html
- Alistair Cockburn, Hexagonal Architecture: https://alistair.cockburn.us/hexagonal-architecture
- OWASP API Security, Broken Object Level Authorization: https://owasp.org/API-Security/editions/2019/en/0xa1-broken-object-level-authorization/
- PostgreSQL Explicit Locking: https://www.postgresql.org/docs/current/static/explicit-locking.html
