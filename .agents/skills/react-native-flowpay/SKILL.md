---
name: react-native-flowpay
description: FlowPay mobile implementation and review skill for React Native, Expo prebuild/development builds, Android-first NFC, react-native-nfc-manager, mobile feature modules, secure token storage, API boundaries, typed navigation, client state, clean MVP boundaries, and mobile implementation plans. Use when Codex works on FlowPay mobile screens, flows, hooks, API clients, storage, NFC adapters, or frontend architecture.
---

# React Native FlowPay

## Mission

Build and review FlowPay mobile changes as a React Native app using Expo prebuild/development builds. The app collects user intent and displays server state; it is never the authority for money, balances, transfer validity, wallet ownership, or ledger writes.

Minimum viable work must still use durable boundaries. Do not accept direct dependency shortcuts, misplaced files, untyped navigation, or framework/library coupling merely because the feature is an MVP. Do not force backend-style clean architecture folder names when React Native idioms are clearer.

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
    app/
      AppProviders.tsx
      navigation/
    modules/
      auth/
      wallet/
      transfers/
      nfc/
    shared/
      api/
      ui/
```

Feature modules should start with the smallest folder set that matches real code:

```text
module/
  screens/
  components/
  hooks/
  api/
  storage/
  adapters/
  types.ts
```

Rules:

- `screens` owns route-level UI.
- `components` owns module-local UI components.
- `hooks` owns reusable UI/session/flow behavior exposed to screens.
- `api` owns backend calls for that module.
- `storage` owns local or secure storage for that module.
- `adapters` owns native or external integrations such as NFC.
- `types.ts` owns simple local TypeScript contracts.
- React hooks are not domain objects.
- Composition root concerns live under `src/app`, not inside feature modules or generated `App.tsx`.
- Navigation must be typed from the beginning; route params are contracts, not incidental strings.
- Do not create empty folders until the module has code for them.
- Do not put providers, hooks, storage adapters, API clients, and types in the module root.
- Introduce `application`, `domain`, or `infrastructure` only when a module becomes complex enough that those names clarify real ownership.

## Clean MVP Rules

- "MVP" may reduce feature scope, but not boundary quality.
- Avoid direct imports from screens to native libraries, raw `axios`, secure storage, NFC libraries, or backend endpoint details.
- `shared/api` may own HTTP mechanics, but must not know where auth tokens are stored.
- Auth storage belongs behind `modules/auth/storage`.
- Feature screens should depend on module hooks/services, not storage/API/native adapters directly.
- Add abstractions only when they protect a real boundary or remove meaningful duplication; avoid pattern-only wrappers.
- Prefer a small correctly placed file over a large temporary file that will need to be split later.

## Mobile Workflow

1. Identify the user flow and module.
2. Decide what state is server authority and what state is local UI state.
3. Place new files in `screens`, `components`, `hooks`, `api`, `storage`, `adapters`, `shared`, or `app` according to ownership.
4. Keep API calls behind module `api/` or `shared/api` boundaries.
5. Keep screens focused on rendering and interaction.
6. Store tokens only through secure storage.
7. Type navigation params before adding routes.
8. For transfer flows, require explicit recipient and amount confirmation.
9. After money movement, refresh financial data from the backend.
10. Use `$testing-flowpay` for UI flow, adapter, and parsing tests.

## NFC Guardrails

- NFC is a native adapter inside the NFC module.
- NFC may check capability, scan/parse payloads, and resolve or prepare a recipient candidate.
- NFC must not execute money movement, validate balance, write ledger records, or bypass transfer confirmation.
- Expo Go is not a valid NFC validation environment.
- Use custom development builds and real Android device validation for real NFC behavior.
- Always preserve manual transfer fallback when NFC is unavailable, disabled, unsupported, or fails.

## Auth and State Guardrails

- Store access tokens in secure storage, not plain async storage.
- Encapsulate secure storage in auth storage; do not import it from screens, shared API, or unrelated modules.
- Do not store passwords after login.
- Do not log tokens, passwords, NFC payload secrets, or private wallet details.
- Treat balance and transaction history as server state.
- Do not let global client state become financial authority.
- The client never chooses the authoritative source wallet.
- Do not introduce Redux/Zustand/global stores for financial data without a documented decision.

## Output Checklist

Before finishing mobile work, state:

- owning module and flow;
- server-authoritative state vs local state;
- boundary choices and any rejected shortcut;
- NFC/auth/security implications;
- device validation required when native behavior changes;
- tests added or still needed.
