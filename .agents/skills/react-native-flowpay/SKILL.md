---
name: react-native-flowpay
description: FlowPay mobile implementation and review skill for React Native, Expo prebuild/development builds, Android-first NFC, react-native-nfc-manager, mobile feature modules, secure token storage, API boundaries, navigation, client state, and mobile implementation plans. Use when Codex works on FlowPay mobile screens, flows, hooks, API clients, storage, NFC adapters, or frontend architecture.
---

# React Native FlowPay

## Mission

Build and review FlowPay mobile changes as a React Native app using Expo prebuild/development builds. The app collects user intent and displays server state; it is never the authority for money, balances, transfer validity, wallet ownership, or ledger writes.

## Required Context

Read relevant parts of:

- `docs/adr/0002-mobile-architecture.md`
- `docs/adr/0003-stack-selection.md`
- `docs/adr/0004-money-and-ledger-model.md`
- `docs/adr/0005-auth-strategy.md`
- `docs/specs/02-use-cases.md`
- `docs/specs/03-domain-model.md`
- `docs/research/01-nfc-feasibility.md`
- `docs/research/06-mobile-architecture-and-tooling.md`

Use `$architecture-advisor` first when adding a native dependency, changing app structure, changing NFC behavior, changing auth storage, or making a cross-cutting state-management decision.

## Module Structure

Default mobile layout:

```text
mobile/
  src/
    modules/
      auth/
      wallet/
      transfers/
      nfc/
    shared/
      api/
      navigation/
      storage/
      ui/
```

Feature modules may use:

```text
module/
  presentation/
  application/
  domain/
  infrastructure/
```

Rules:

- `presentation` owns screens/components.
- `application` owns user flows and orchestration.
- `domain` owns local concepts and safe client-side validation.
- `infrastructure` owns API clients, secure storage, NFC, platform checks, and device integrations.
- React hooks are not domain objects.

## Mobile Workflow

1. Identify the user flow and module.
2. Decide what state is server authority and what state is local UI state.
3. Keep API calls behind module/shared infrastructure boundaries.
4. Keep screens focused on rendering and interaction.
5. Store tokens only through secure storage.
6. For transfer flows, require explicit recipient and amount confirmation.
7. After money movement, refresh financial data from the backend.
8. Use `$testing-flowpay` for UI flow, adapter, and parsing tests.

## NFC Guardrails

- NFC is an infrastructure adapter.
- NFC may check capability, scan/parse payloads, and resolve or prepare a recipient candidate.
- NFC must not execute money movement, validate balance, write ledger records, or bypass transfer confirmation.
- Expo Go is not a valid NFC validation environment.
- Use custom development builds and real Android device validation for real NFC behavior.
- Always preserve manual transfer fallback when NFC is unavailable, disabled, unsupported, or fails.

## Auth and State Guardrails

- Store access tokens in secure storage, not plain async storage.
- Do not store passwords after login.
- Do not log tokens, passwords, NFC payload secrets, or private wallet details.
- Treat balance and transaction history as server state.
- Do not let global client state become financial authority.
- The client never chooses the authoritative source wallet.

## Output Checklist

Before finishing mobile work, state:

- owning module and flow;
- server-authoritative state vs local state;
- NFC/auth/security implications;
- device validation required when native behavior changes;
- tests added or still needed.
