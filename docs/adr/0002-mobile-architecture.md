# ADR 0002: Mobile Architecture

## Status

Accepted

## Context

FlowPay's main client experience is mobile-first because the selected value feature is NFC-assisted face-to-face transfer.

The mobile app must support:

- user authentication;
- wallet balance display;
- transaction history display;
- manual transfer initiation;
- NFC-assisted transfer initiation on supported Android devices;
- fallback to manual recipient selection when NFC is unavailable.

The mobile app must not become a financial authority. Money movement, balance calculation, transfer validation, idempotency, and ledger writes belong to the backend.

## Decision

FlowPay will use React Native with Expo tooling, using prebuild / Continuous Native Generation and custom development builds.

The first version is Android-first.

The project will not rely on Expo Go for NFC development or testing because NFC requires native capabilities and configuration that are outside a pure Expo Go workflow.

The app will be organized by feature modules with clean internal boundaries:

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

Each module may use:

```text
module/
  presentation/
  application/
  domain/
  infrastructure/
```

Where:

- `presentation` owns screens and UI components.
- `application` owns user flows and use-case orchestration.
- `domain` owns local concepts and safe client-side validations.
- `infrastructure` owns API clients, local storage, native adapters, and platform integrations.

This structure intentionally extends the simpler `data/domain/presentation` split commonly seen in React Native projects. `infrastructure` is used instead of `data` because not every external dependency is data access; NFC, secure storage, device capability checks, and API clients are all infrastructure concerns.

React hooks are not considered domain objects. Hooks may coordinate UI behavior or call application services, but the domain layer must remain independent from React.

## Rationale

### React Compatibility

React Native keeps the frontend close to the React mental model while still allowing native mobile capabilities.

This is a better fit than Flutter because the project prioritizes React compatibility and fast movement from React knowledge.

### NFC Support

NFC requires native platform access.

Expo Go is not enough for this product because it only supports native libraries included in the Expo SDK. FlowPay needs a custom development build to use NFC libraries and Android native configuration.

Using Expo prebuild/development builds provides a practical middle path:

- faster setup than React Native CLI alone;
- access to native Android configuration;
- compatibility with native libraries;
- a future path to iOS if the product expands.

### Product Safety

The mobile app collects user intent, but the backend owns financial truth.

The app can help the user select a recipient, enter an amount, and confirm the transfer. It cannot decide that a transfer is valid, update balances authoritatively, or write ledger records.

### NFC Boundary

NFC is treated as an infrastructure adapter.

The NFC module may:

- check device capability;
- scan or parse NFC payloads;
- resolve or prepare recipient data;
- pass a recipient candidate to the transfer flow.

The NFC module must not:

- execute money movement;
- validate available balance;
- write transactions;
- bypass transfer confirmation;
- bypass backend authorization.

## Alternatives Considered

### React Native CLI

Rejected as the default starting point.

It provides maximum native control, but requires more setup and native project maintenance. FlowPay needs native access, but Expo prebuild/development builds provide enough control with faster iteration.

### Expo Go Only

Rejected.

Expo Go is useful for pure JavaScript prototypes, but it blocks the main NFC feature because it cannot include arbitrary native modules or native Android configuration.

### Ionic React + Capacitor

Rejected as the primary mobile architecture.

It is attractive for React web familiarity, but FlowPay is mobile/NFC-first. React Native is a better fit for native-feeling mobile interactions and the existing NFC ecosystem.

### Flutter

Rejected.

Flutter is a capable mobile framework, but it does not align with the goal of staying close to React.

## Mobile Security Boundaries

- The app never calculates authoritative balance.
- The app never decides whether a transfer is valid.
- The app never writes ledger records.
- The app never chooses the source wallet as an authority; the backend derives it from the authenticated user.
- NFC only resolves or prepares the receiver.
- The sender must explicitly confirm recipient and amount before transfer execution.
- Transfer execution always goes through the backend API.
- After money movement, the app refreshes state from the backend.

## Server State and Local State

The app may keep local UI state and cache server responses for user experience.

Server state examples:

- authenticated user summary;
- wallet balance;
- transaction history;
- transfer result;
- recipient data.

Local-only state examples:

- currently typed amount;
- selected recipient candidate before confirmation;
- NFC scan status;
- loading and error UI state.

Any cached financial data must be treated as display data, not authority.

Global client state libraries may be used only when they simplify UI/session coordination. They must not become the source of truth for balances, transaction history, or transfer validity.

## NFC Capability Policy

The app must show NFC functionality only when the required Android capabilities are available.

If NFC is not available, disabled, unsupported, or fails during scanning, the app must preserve the manual transfer path.

NFC beta is intended for trusted face-to-face transfers and must be presented with that limitation.

## Consequences

### Positive

- Keeps development close to React.
- Enables fast mobile iteration.
- Allows native Android NFC integration.
- Avoids relying on Expo Go for a native feature.
- Keeps a future path to iOS.
- Preserves backend as financial authority.

### Negative

- Requires custom development builds.
- Requires validating NFC behavior on real Android hardware.
- Requires managing native configuration through Expo prebuild/CNG.
- Adds React Native and Python as separate language ecosystems if the backend uses FastAPI.

## Guardrails

- NFC code must live behind an infrastructure adapter.
- Transfer screens must call transfer application flows, not NFC internals.
- API clients must be isolated under infrastructure/shared API boundaries.
- React hooks must not be placed in the domain layer.
- Auth token storage must use secure storage, not plain async storage.
- Client state stores must not be treated as financial source of truth.
- Financial data shown in the UI must be refreshed from backend after a transfer.
- The app must support manual transfer fallback when NFC is unavailable.
- Native dependencies should be kept minimal and checked for compatibility before adoption.

## References

- Expo custom native code: https://docs.expo.dev/workflow/customizing/
- Expo Continuous Native Generation: https://docs.expo.dev/workflow/continuous-native-generation/
- React Native native platform: https://reactnative.dev/docs/native-platform
- `react-native-nfc-manager`: https://github.com/revtel/react-native-nfc-manager
