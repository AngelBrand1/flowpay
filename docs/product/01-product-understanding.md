# Product Understanding

## Context

FlowPay is a digital wallet for people who transfer money among themselves in everyday situations: shared meals, rent, services, family support, classes, and small freelance work.

The product should make informal money transfers simple, reliable, and easy to understand.


## Product Problem

Traditional bank transfers solve money movement, but they are not always designed for everyday payments between people. They tend to feel cumbersome for simple scenarios, require data or steps that add friction, and leave little room to build experiences tailored to informal relationships.

FlowPay should help people transfer money directly, reliably, and with an experience designed for interactions between people.

## Primary Users

- A person who pays for a shared expense upfront and needs to collect from others.
- A person who owes money to someone else and wants to pay quickly with confidence.
- A person who receives recurring informal payments, such as rent, family support, classes, or freelance work.

## Key Scenarios

- A friend pays the bill for a birthday dinner and collects each person's share.
- Roommates split rent, utilities, or groceries.
- Siblings send money to a parent each month.
- A teacher receives small payments from students.
- Freelancers pay or collect for small jobs.

## Product Scope

The initial product must support:

- Create a user wallet.
- Grant an automatic welcome bonus when a wallet is created.
- Transfer balance between wallets.
- Initiate face-to-face transfers with NFC in beta on supported Android devices.
- Verify available balance.
- View transaction history.

The initial product will not support:

- Real payment rails, banks, cards, PSE, Stripe, or cash entry providers.
- Real identity verification or compliance flows.
- User-initiated balance loading.
- Multi-currency support.
- Production-grade fraud detection.
- Fully distributed microservices.

## Product Principles

- The integrity of money is more important than feature breadth.
- Transactions must be auditable.
- The product should reduce friction in everyday payments between people.
- The initial experience should remain small enough to be reliable.
- Technical decisions should serve the product model, not the reverse.

## Selected Value Feature

The selected value feature is NFC-assisted face-to-face transfers.

NFC reduces friction when two people are physically together. Instead of searching for a user or manually entering recipient data, the sender can use device proximity to start the transfer flow.

The first version treats NFC as beta and Android-first. It should be used with trusted contacts, require explicit sender confirmation, run only when the devices support the required NFC flow, and reuse the same transfer rules as the manual flow.

Other value opportunities, such as contextual payments, payment requests, and recurring obligations, remain candidates for future versions.

## Key Risks

- Lose or duplicate money during transfers.
- Update balances without an auditable transaction trail.
- Build too many workflows before the wallet core is reliable.
- Underestimate NFC complexity across Android devices.
- Treat NFC as a shortcut around confirmation or transfer integrity.

## Initial Decisions

- Balances should be derived from recorded transactions, following an auditable transaction-based model.
- The first version requires simple authentication with username and password.
- The first version supports sending money directly between wallets, manually or through an NFC-assisted Android beta flow when supported.
- The first version does not support payment requests, cancellations, rejections, expirations, or reversals.
- Each transaction must record, at minimum, date, time, amount, and origin.

## Product Success Criteria

FlowPay is successful if:

- Money transfers are reliable, auditable, and do not create, lose, or duplicate funds.
- NFC reduces friction for face-to-face transfers without weakening money integrity.
- The product remains small enough to reason about, test, and evolve.
