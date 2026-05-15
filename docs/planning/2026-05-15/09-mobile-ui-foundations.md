# FlowPay Mobile — UI Foundations

## Overview

Introduce a small shared UI foundation for the React Native app so visual decisions live in one place instead of being repeated inside every screen.

This is not a full design system. The goal is a pragmatic MVP layer: theme tokens plus a few reusable primitives for screens, text, inputs, and buttons. That gives FlowPay a more polished presentation while keeping future style changes cheap.

After this plan, auth and home screens should use shared UI components instead of raw repeated `StyleSheet` definitions for common visual patterns.

---

## Current State

The mobile app already has the expected shared UI boundary:

```text
mobile/src/shared/ui/
```

Current screens define local styles directly:

```text
mobile/src/modules/auth/screens/LoginScreen.tsx
mobile/src/modules/auth/screens/RegisterScreen.tsx
mobile/src/app/screens/HomeScreen.tsx
```

Repeated concerns today:

- screen padding;
- centered auth layout;
- title text;
- body/subtitle text;
- input border, radius, and spacing;
- error text color;
- button styling through React Native's default `Button`.

This is acceptable for the first screens, but it will become expensive once wallet, transfers, NFC, and transaction history screens are added.

---

## Architectural Intent

### Principle

Screens should own product flow and interaction. Shared UI primitives should own common visual rules.

This keeps route-level components focused on:

- what the screen renders;
- what hooks it calls;
- what happens when the user taps or submits.

Shared UI owns:

- colors;
- spacing;
- typography;
- border radius;
- reusable button variants;
- reusable text variants;
- reusable input appearance;
- common screen layout.

### Non-goals

- Do not introduce a large UI library yet.
- Do not introduce NativeWind, Tamagui, React Native Paper, or a full token pipeline for this MVP step.
- Do not build dark mode yet.
- Do not create speculative variants that no current screen needs.
- Do not move business, auth, wallet, transfer, or NFC state into UI components.

---

## Proposed Structure

Create the smallest useful shared UI layer:

```text
mobile/src/shared/ui/
  AppButton.tsx
  AppText.tsx
  index.ts
  Screen.tsx
  TextField.tsx
  theme.ts
```

Ownership:

- `theme.ts` defines design tokens.
- `Screen.tsx` defines common screen container layout.
- `AppText.tsx` defines text variants.
- `index.ts` re-exports shared UI primitives for cleaner imports.
- `TextField.tsx` defines input styling.
- `AppButton.tsx` defines button variants and loading/disabled behavior.

---

## Theme Tokens

Create `mobile/src/shared/ui/theme.ts`.

Initial token groups:

```typescript
export const theme = {
  colors: {
    background: '#f8fafc',
    surface: '#ffffff',
    primary: '#2563eb',
    primaryPressed: '#1d4ed8',
    primaryText: '#ffffff',
    text: '#0f172a',
    mutedText: '#64748b',
    border: '#cbd5e1',
    danger: '#dc2626',
    dangerPressed: '#b91c1c',
    success: '#16a34a',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  radius: {
    sm: 6,
    md: 8,
    lg: 12,
  },
  typography: {
    title: 28,
    subtitle: 18,
    body: 16,
    small: 14,
  },
}
```

Rules:

- Screens should avoid hardcoded visual values when a theme token exists.
- Feature-specific spacing can remain local if it is genuinely unique.
- Avoid tokenizing everything before the app needs it.

---

## Shared Components

### `Screen`

Purpose:

- common background;
- common horizontal padding;
- optional centered layout for auth-style screens;
- safe-area handling for mobile devices;
- optional keyboard-aware behavior for auth forms;
- safe default layout for future screens.

Initial API:

```typescript
import type { StyleProp, ViewStyle } from 'react-native'

type ScreenProps = {
  children: React.ReactNode
  centered?: boolean
  keyboardAware?: boolean
  style?: StyleProp<ViewStyle>
  contentStyle?: StyleProp<ViewStyle>
}
```

Usage:

```tsx
<Screen centered keyboardAware>
  ...
</Screen>
```

Implementation notes:

- Use `SafeAreaView` from `react-native-safe-area-context` because the app already depends on it.
- For `keyboardAware`, keep the first version simple with React Native primitives such as `KeyboardAvoidingView` and/or `ScrollView`.
- `style` should customize the outer safe-area container when needed.
- `contentStyle` should customize the inner layout without forcing screens to bypass `Screen`.

### `AppText`

Purpose:

- centralize title, subtitle, body, muted, and error text styles.

Initial variants:

```text
title
subtitle
body
muted
error
```

Usage:

```tsx
<AppText variant="title">FlowPay</AppText>
<AppText variant="error">{error}</AppText>
```

Initial API should extend native text props so screens can still use standard React Native behavior:

```typescript
import type { TextProps } from 'react-native'

type AppTextProps = TextProps & {
  variant?: 'title' | 'subtitle' | 'body' | 'muted' | 'error'
}
```

### `TextField`

Purpose:

- replace repeated `TextInput` styling.
- keep input behavior controlled by the screen.

Initial API should mirror the native `TextInput` props where possible:

```typescript
type TextFieldProps = TextInputProps & {
  error?: boolean
}
```

Implementation notes:

- Preserve native `TextInputProps`, including `style`.
- Combine internal styles with caller-provided `style`; do not make screens fork the component for minor layout adjustments.
- Use the `error` prop only for visual state. Error message text stays outside the input and remains owned by the screen or form component.

Usage:

```tsx
<TextField
  placeholder="Usuario"
  autoCapitalize="none"
  value={username}
  onChangeText={setUsername}
/>
```

### `AppButton`

Purpose:

- replace raw React Native `Button`;
- support consistent variants;
- support disabled and loading states.

Initial variants:

```text
primary
secondary
danger
```

Variant intent:

- `primary`: filled action button for the main submit/continue action.
- `secondary`: lower-emphasis outline or text-style action for navigation such as "Crear cuenta" or "Ya tengo cuenta".
- `danger`: destructive or session-ending action such as logout.

Initial API:

```typescript
import type { PressableProps, StyleProp, ViewStyle } from 'react-native'

type AppButtonProps = {
  title: string
  onPress: PressableProps['onPress']
  variant?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean
  loading?: boolean
  style?: StyleProp<ViewStyle>
}
```

Implementation notes:

- Use `Pressable`, not React Native's built-in `Button`, so variants, pressed state, disabled state, and loading state can be styled consistently.
- While `loading` is true, disable presses and show a small `ActivityIndicator` inside the button.
- Keep button text to a single label for now; do not add icons or complex children until a real screen needs them.

Usage:

```tsx
<AppButton title="Entrar" onPress={() => submit(username, password)} loading={isLoading} />
<AppButton title="Crear cuenta" variant="secondary" onPress={() => navigation.navigate('Register')} />
<AppButton title="Cerrar sesión" variant="danger" onPress={logout} />
```

---

## Migration Plan

### 1. Create shared UI foundation

Files:

```text
mobile/src/shared/ui/theme.ts
mobile/src/shared/ui/Screen.tsx
mobile/src/shared/ui/AppText.tsx
mobile/src/shared/ui/TextField.tsx
mobile/src/shared/ui/AppButton.tsx
mobile/src/shared/ui/index.ts
```

Keep each component small and typed. Do not add external dependencies.

`index.ts` should re-export the primitives:

```typescript
export { AppButton } from './AppButton'
export { AppText } from './AppText'
export { Screen } from './Screen'
export { TextField } from './TextField'
export { theme } from './theme'
```

### 2. Migrate Login screen

File:

```text
mobile/src/modules/auth/screens/LoginScreen.tsx
```

Replace:

- raw `View` container with `Screen centered keyboardAware`;
- title `Text` with `AppText`;
- `TextInput` with `TextField`;
- raw `Button` with `AppButton`;
- local repeated styles with shared UI components.

Keep local state and `useLogin` behavior unchanged.

### 3. Migrate Register screen

File:

```text
mobile/src/modules/auth/screens/RegisterScreen.tsx
```

Apply the same migration as Login.

Keep navigation and `useRegister` behavior unchanged.

### 4. Migrate Home screen

File:

```text
mobile/src/app/screens/HomeScreen.tsx
```

Replace:

- raw centered container with `Screen`;
- title/subtitle text with `AppText`;
- logout button with `AppButton variant="danger"`.

Keep `useAuthSession` behavior unchanged.

### 5. Visual polish pass

After migration, tune only shared files:

- improve button height and press feedback;
- improve input contrast;
- improve screen background;
- improve title/subtitle spacing;
- ensure error text is readable.

This is where presentation quality should improve without changing each screen individually.

---

## Acceptance Criteria

- Login, Register, and Home no longer duplicate common button/input/text/screen styles.
- Common visual values come from `theme.ts`.
- `AppButton` supports `primary`, `secondary`, `danger`, `disabled`, and `loading`.
- `AppButton` is implemented with `Pressable`, not the built-in React Native `Button`.
- `Screen` uses safe-area handling and supports keyboard-aware auth layouts.
- `AppText` and `TextField` preserve native React Native props instead of hiding them.
- Shared UI exports are available from `mobile/src/shared/ui`.
- Auth screen behavior remains unchanged.
- Logout behavior remains unchanged.
- No new styling library is introduced.
- No auth, wallet, transfer, ledger, or NFC business logic moves into `shared/ui`.
- TypeScript compiles.
- Existing mobile tests pass.

---

## Validation

Run:

```bash
cd mobile
npm test
```

If time allows, run the app visually:

```bash
cd mobile
npm run web
```

Manual checks:

- Login screen renders cleanly.
- Register screen renders cleanly.
- Loading states still show during submit.
- Error messages still show.
- Home screen shows the username.
- Logout still returns to the public flow.
- Text does not overflow buttons or inputs.

---

## Estimated Cost

Expected implementation time:

```text
2 to 4 hours
```

Breakdown:

- theme and primitives: 1 to 2 hours;
- screen migration: 1 hour;
- visual polish and validation: 1 hour.

---

## Future Extensions

Add only when real screens need them:

- `Card` for repeated transaction or wallet summaries;
- `AmountText` for currency display;
- `InlineError` for form-level errors;
- `EmptyState` for empty transaction history;
- `ToolbarButton` or icon buttons for NFC and scan actions;
- dark mode tokens;
- accessibility-focused variants after the main flows exist.

---

## Roadmap Fit

This plan belongs to frontend roadmap Level 4: design systems, but implemented at MVP scale.

The learning objective is styling architecture: separate product screens from reusable visual primitives so the app can change presentation without rewriting every screen.
