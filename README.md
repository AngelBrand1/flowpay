# FlowPay

FlowPay is a digital wallet for person-to-person money transfers in everyday situations.

The product prioritizes a simple and reliable financial core: create a wallet, grant an automatic welcome bonus, transfer balance between users, check balance and transaction history, and support NFC-assisted face-to-face transfers in an Android-first beta.

## Project Status

The project is in definition phase. Before writing application code, the repository documents the product, domain rules, use cases, conceptual model, and feasibility of the NFC feature.

## Documentation

- `docs/product/`: product definition and main feature selection.
- `docs/specs/`: domain rules, use cases, and conceptual model.
- `docs/adr/`: architecture decision records.

## Principles

- Money integrity is more important than feature breadth.
- Balance is derived from auditable transactions.
- NFC reduces friction, but it does not move money outside the safe transfer flow.
- The first version should remain small, verifiable, and easy to evolve.
