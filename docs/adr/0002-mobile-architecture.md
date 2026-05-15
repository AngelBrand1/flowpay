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

The app will be organized by feature modules with clean internal boundaries using React Native idioms rather than a strict backend-style hexagonal layout:

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

Modules should start with the smallest folder set that matches real code:

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

Where:

- `screens` owns route-level UI.
- `components` owns module-local UI components.
- `hooks` owns reusable UI/session/flow behavior exposed to screens.
- `api` owns backend calls for that module.
- `storage` owns local or secure storage for that module.
- `adapters` owns native or external integrations such as NFC.
- `types.ts` owns simple local TypeScript contracts.

Formal clean-architecture folders such as `application`, `domain`, or `infrastructure` may be introduced inside a module when complexity justifies them, especially for transfers or NFC. They are not the default scaffold because frontend modules often remain clearer with conventional React Native names.

React hooks are not domain objects. Hooks may coordinate UI behavior or call API/adapters, but financial authority remains on the backend.

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

NFC is treated as a native adapter inside the NFC module.

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

State ownership is split into three categories:

- Server state is managed with TanStack Query.
- Auth/session state is managed by the auth module provider and secure token storage.
- Screen-local UI state is managed with local React state or module hooks.

Server state examples:

- authenticated user summary;
- wallet balance;
- transaction history;
- transfer result;
- recipient data.

Any cached financial data must be treated as display data, not authority.

Auth/session state examples:

- presence of a local access token;
- restore-session loading state;
- login and logout actions;
- authenticated user summary after it is fetched from the backend.

Local-only state examples:

- currently typed amount;
- selected recipient candidate before confirmation;
- NFC scan status;
- loading and error UI state.

Global client state libraries may be used only when they simplify UI/session coordination. They must not become the source of truth for balances, transaction history, or transfer validity.

The first version should not introduce Redux or Zustand. Reconsider a global client-state library only if shared non-server UI state becomes difficult to manage with module hooks and local state.

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
- Uses React Native folder names that are easier to learn and maintain than backend-style layers.

### Negative

- Requires custom development builds.
- Requires validating NFC behavior on real Android hardware.
- Requires managing native configuration through Expo prebuild/CNG.
- Adds React Native and Python as separate language ecosystems if the backend uses FastAPI.
- Requires discipline so feature folders do not become unstructured bags of hooks, screens, and adapters.

## Guardrails

- NFC code must live behind a module adapter, not directly inside screens.
- Transfer screens must call transfer module hooks/services, not NFC internals.
- API calls must be isolated under module `api/` or `shared/api/`, not scattered through screens.
- Auth token storage must use secure storage, not plain async storage.
- Auth token storage must be hidden behind the auth module's `storage/` boundary.
- Client state stores must not be treated as financial source of truth.
- Financial data shown in the UI must be refreshed from backend after a transfer.
- The app must support manual transfer fallback when NFC is unavailable.
- Native dependencies should be kept minimal and checked for compatibility before adoption.
- Typed navigation params should be defined before adding routes that pass data.

## References

- Expo custom native code: https://docs.expo.dev/workflow/customizing/
- Expo Continuous Native Generation: https://docs.expo.dev/workflow/continuous-native-generation/
- React Native native platform: https://reactnative.dev/docs/native-platform
- `react-native-nfc-manager`: https://github.com/revtel/react-native-nfc-manager
