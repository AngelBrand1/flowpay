# Transaction History — Mobile Plan

## Overview

Implement the Transaction History screen on mobile: a FlatList-based screen with infinite scroll where users see all their wallet movements (welcome bonus, transfers sent/received), filter by type using server-side pagination, and get automatic refresh after completing a transfer.

## Files Analyzed

### Mobile Module Structure

1. **`mobile/src/modules/wallet/screens/WalletScreen.tsx`** (101 lines)
   - Uses `Screen`, `useNavigation`, `useWallet`
   - Botón "Transfer" navega a `'Transfer'` — agregar botón "Ver historial"
   - `contentStyle={styles.content}` con `justifyContent: 'space-between'`

2. **`mobile/src/modules/wallet/hooks/useWallet.ts`** (19 lines)
   - `useQuery` con `queryKey: ['wallet']`, `staleTime: 0`
   - Retorna `{ wallet, isLoading, error, refetch }`

3. **`mobile/src/modules/wallet/api/walletApi.ts`** (26 lines)
   - `extractApiError` + `WalletApiError` con código
   - `getWallet()` → `httpClient.get<WalletResponse>('/wallet')`
   - Aquí se agrega `getTransactions()`

4. **`mobile/src/modules/wallet/types.ts`** (9 lines)
   - Solo tiene `Wallet` y `WalletResponse`
   - Agregar `Transaction`, `TransactionCounterparty`, `TransactionsPage`

5. **`mobile/src/app/navigation/types.ts`** (9 lines)
   - `ProtectedStackParamList`: `Wallet`, `Transfer`
   - Agregar `TransactionHistory: undefined`

6. **`mobile/src/app/navigation/RootNavigator.tsx`** (48 lines)
   - `ProtectedNavigator` monta Wallet y Transfer con `headerShown: false`
   - Agregar ruta `TransactionHistory`

7. **`mobile/src/modules/transfers/hooks/useTransfer.ts`** (62 lines)
   - `onSuccess` invalida `['wallet']`
   - Agregar invalidación de `['wallet', 'transactions']`

8. **`mobile/src/shared/ui/Screen.tsx`** (32 lines)
   - **Crítico**: `scrollEnabled={keyboardAware}` — sin `keyboardAware`, el ScrollView no hace scroll
   - `FlatList` dentro de `ScrollView` es un **anti-patrón prohibido en React Native** (nested VirtualizedLists)
   - `TransactionHistoryScreen` NO puede usar `Screen` — necesita un wrapper compartido sin `ScrollView` + `FlatList` directo

9. **`mobile/src/shared/ui/theme.ts`** (34 lines)
   - `colors.success` = `#16a34a`, `colors.danger` = `#dc2626`
   - `colors.surface` = `#ffffff`, `colors.border` = `#cbd5e1`
   - Verde para crédito, rojo para débito

10. **Backend: `backend/src/flowpay/ledger/adapters/router.py`** (132 lines)
    - Current: `GET /wallet/transactions?limit=20&cursor=XX`
    - Required update: `GET /wallet/transactions?limit=20&cursor=XX&type=credit|debit`
    - `TransactionResponse`: `{ id, type, amount, currency, source, operation_id, counterparty, created_at }`
    - `type`: `"credit"` | `"debit"`
    - `source`: `"welcome_bonus"` | `"manual_transfer"`
    - `counterparty`: `{ wallet_id, username }` o `null`
    - Cursor = string del offset; `next_cursor: null` = última página

11. **Backend: `backend/src/flowpay/ledger/application/ledger_service.py`**
    - Bono de bienvenida: `WELCOME_BONUS_AMOUNT = 50_000` COP, `source = "welcome_bonus"`, `counterparty = null`

## Current State Analysis

```
mobile/src/modules/wallet/
  api/
    walletApi.ts                    ← agregar getTransactions()
  hooks/
    useWallet.ts                    ← sin cambios
    useTransactionHistory.ts        ← CREAR
  screens/
    WalletScreen.tsx                ← agregar botón "Ver historial"
    TransactionHistoryScreen.tsx    ← CREAR
  types.ts                          ← agregar Transaction, TransactionsPage

mobile/src/shared/ui/
  ListScreen.tsx                    ← CREAR wrapper safe-area sin ScrollView para listas virtualizadas
  index.ts                          ← exportar ListScreen

mobile/src/app/navigation/
  types.ts                          ← agregar TransactionHistory
  RootNavigator.tsx                 ← agregar ruta + import

mobile/src/modules/transfers/hooks/
  useTransfer.ts                    ← invalidar ['wallet', 'transactions'] en onSuccess

backend/src/flowpay/ledger/
  adapters/router.py                ← aceptar query param type opcional
  application/ledger_service.py      ← filtrar por type antes de paginar

backend/tests/integration/ledger/
  test_ledger_endpoints.py           ← cubrir filtro credit/debit
```

## Dependency Analysis

```mermaid
graph TB
    WalletScreen -->|navigate TransactionHistory| TransactionHistoryScreen
    TransactionHistoryScreen -->|useTransactionHistory| Hook
    Hook["useTransactionHistory\nuseInfiniteQuery queryKey: ['wallet','transactions',filter]"] -->|getTransactions| walletApi
    walletApi -->|GET /wallet/transactions?type=credit/debit| httpClient
    useTransfer -->|onSuccess invalidate ['wallet','transactions']| ReactQueryCache
    TransactionHistoryScreen -->|onEndReached| Hook
    Hook -->|fetchNextPage cursor=N| walletApi
    TransactionHistoryScreen -->|filter credit/debit| ServerFilteredPages
```

## Proposed Changes

### Files to Create

#### 1. `mobile/src/modules/wallet/hooks/useTransactionHistory.ts` (~55 lines)

```typescript
import { useInfiniteQuery } from '@tanstack/react-query'
import { getTransactions, WalletApiError } from '../api/walletApi'
import type { Transaction } from '../types'

export type TransactionFilter = 'all' | 'credit' | 'debit'

export function mapTransactionError(error: unknown): string {
  if (error instanceof WalletApiError) {
    switch (error.code) {
      case 'wallet_not_found':
        return 'Billetera no encontrada'
      default:
        return 'Error al cargar el historial'
    }
  }
  return 'Error de conexión. Intenta de nuevo.'
}

export function useTransactionHistory(filter: TransactionFilter) {
  const transactionType = filter === 'all' ? undefined : filter
  const { data, isLoading, isFetchingNextPage, isRefetching, error, fetchNextPage, hasNextPage, refetch } =
    useInfiniteQuery({
      queryKey: ['wallet', 'transactions', filter],
      queryFn: ({ pageParam }) =>
        getTransactions({ cursor: pageParam as string | undefined, type: transactionType }),
      initialPageParam: undefined,
      getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
      staleTime: 0,
    })

  const allTransactions: Transaction[] = data?.pages.flatMap((p) => p.transactions) ?? []

  return {
    transactions: allTransactions,
    isLoading,
    isFetchingNextPage,
    isRefetching,
    error: error ? mapTransactionError(error) : null,
    fetchNextPage,
    hasNextPage: hasNextPage ?? false,
    refetch,
  }
}
```

**Rationale:**
- `useInfiniteQuery` gestiona las páginas acumuladas automáticamente
- `getNextPageParam` retorna `undefined` cuando `next_cursor` es null → `hasNextPage = false`
- `initialPageParam: undefined` → primera llamada sin cursor (page 0)
- Aplana todas las páginas en un array para pasarlo a FlatList
- `staleTime: 0` = siempre refetch al montar

---

#### 2. `mobile/src/modules/wallet/screens/TransactionHistoryScreen.tsx` (~180 lines)

```typescript
import React, { useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { ProtectedStackParamList } from '../../../app/navigation/types'
import { AppText, ListScreen, theme } from '../../../shared/ui'
import { useTransactionHistory, type TransactionFilter } from '../hooks/useTransactionHistory'
import type { Transaction } from '../types'

type TransactionHistoryNavigation = NativeStackNavigationProp<
  ProtectedStackParamList,
  'TransactionHistory'
>

function formatAmount(amount: number, type: string): string {
  const sign = type === 'credit' ? '+' : '-'
  return `${sign} COP ${amount.toLocaleString('es-CO')}`
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function getLabel(tx: Transaction): string {
  if (tx.source === 'welcome_bonus') return 'Bono de bienvenida'
  if (tx.counterparty?.username) {
    return tx.type === 'credit'
      ? `Recibido de ${tx.counterparty.username}`
      : `Enviado a ${tx.counterparty.username}`
  }
  return tx.type === 'credit' ? 'Crédito' : 'Débito'
}

function TransactionItem({ item }: { item: Transaction }) {
  const isCredit = item.type === 'credit'
  return (
    <View style={styles.item}>
      <View style={[styles.iconBadge, isCredit ? styles.creditBadge : styles.debitBadge]}>
        <AppText style={[styles.iconText, isCredit ? styles.creditText : styles.debitText]}>
          {isCredit ? '↓' : '↑'}
        </AppText>
      </View>
      <View style={styles.itemInfo}>
        <AppText variant="body" style={styles.itemLabel}>{getLabel(item)}</AppText>
        <AppText variant="muted" style={styles.itemDate}>{formatDate(item.created_at)}</AppText>
      </View>
      <AppText
        variant="subtitle"
        style={[styles.itemAmount, isCredit ? styles.creditAmount : styles.debitAmount]}
      >
        {formatAmount(item.amount, item.type)}
      </AppText>
    </View>
  )
}

const FILTERS: { label: string; value: TransactionFilter }[] = [
  { label: 'Todas', value: 'all' },
  { label: 'Recibidas', value: 'credit' },
  { label: 'Enviadas', value: 'debit' },
]

export function TransactionHistoryScreen() {
  const navigation = useNavigation<TransactionHistoryNavigation>()
  const [filter, setFilter] = useState<TransactionFilter>('all')
  const { transactions, isLoading, isFetchingNextPage, isRefetching, error, fetchNextPage, hasNextPage, refetch } =
    useTransactionHistory(filter)

  const handleEndReached = () => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage()
  }

  if (isLoading) {
    return (
      <ListScreen>
        <Header onBack={() => navigation.goBack()} />
        <View style={styles.centered}><ActivityIndicator /></View>
      </ListScreen>
    )
  }

  if (error) {
    return (
      <ListScreen>
        <Header onBack={() => navigation.goBack()} />
        <View style={styles.centered}>
          <AppText variant="error">{error}</AppText>
        </View>
      </ListScreen>
    )
  }

  return (
    <ListScreen>
      <Header onBack={() => navigation.goBack()} />

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.value}
            onPress={() => setFilter(f.value)}
            style={[styles.filterTab, filter === f.value && styles.filterTabActive]}
          >
            <AppText style={[styles.filterLabel, filter === f.value && styles.filterLabelActive]}>
              {f.label}
            </AppText>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TransactionItem item={item} />}
        contentContainerStyle={[styles.list, transactions.length === 0 && styles.listEmpty]}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
        ListFooterComponent={isFetchingNextPage ? <ActivityIndicator style={styles.loader} /> : null}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <AppText variant="muted" style={styles.emptyText}>
              No tienes movimientos aún
            </AppText>
          </View>
        }
      />
    </ListScreen>
  )
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} style={styles.backButton}>
        <AppText style={styles.backText}>‹ Volver</AppText>
      </Pressable>
      <AppText variant="title" style={styles.title}>Historial</AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  backButton: { marginBottom: theme.spacing.sm },
  backText: { color: theme.colors.primary, fontSize: theme.typography.body },
  title: {},
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  filterTab: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterTabActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterLabel: { fontSize: theme.typography.small, color: theme.colors.mutedText },
  filterLabelActive: { color: theme.colors.primaryText, fontWeight: '600' },
  list: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  listEmpty: { flex: 1 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: theme.spacing.md,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  creditBadge: { backgroundColor: '#dcfce7' },
  debitBadge: { backgroundColor: '#fee2e2' },
  iconText: { fontSize: 18, fontWeight: '700' },
  creditText: { color: theme.colors.success },
  debitText: { color: theme.colors.danger },
  itemInfo: { flex: 1 },
  itemLabel: { fontWeight: '500' },
  itemDate: { fontSize: theme.typography.small, marginTop: theme.spacing.xs },
  itemAmount: { textAlign: 'right' },
  creditAmount: { color: theme.colors.success },
  debitAmount: { color: theme.colors.danger },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { textAlign: 'center' },
  loader: { paddingVertical: theme.spacing.lg },
})
```

**Rationale:**
- `ListScreen` mantiene el patrón local de wrappers compartidos y evita importar `react-native-safe-area-context` directamente desde la pantalla
- **FlatList directa** como hija del wrapper sin `ScrollView` — evita el anti-patrón `FlatList` dentro de `ScrollView`
- `onEndReached` + `hasNextPage` controlan el infinite scroll
- `RefreshControl` → pull-to-refresh llama a `refetch` y refleja `isRefetching`
- Filtrado server-side por tipo para no mostrar vacíos falsos con páginas parciales
- Header con botón `‹ Volver` explícito, consistente con `headerShown: false`
- Empty state con mensaje claro

---

### Files to Modify

#### 1. `mobile/src/shared/ui/ListScreen.tsx`

**Proposed — new shared wrapper:**
```typescript
import React from 'react'
import { StyleProp, StyleSheet, ViewStyle } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { theme } from './theme'

type ListScreenProps = {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
}

export function ListScreen({ children, style }: ListScreenProps) {
  return <SafeAreaView style={[styles.container, style]}>{children}</SafeAreaView>
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
})
```

**Rationale:**
- Preserva el patrón actual: las pantallas consumen `shared/ui`, no `react-native-safe-area-context` directamente.
- Evita reutilizar `Screen`, porque `Screen` contiene `ScrollView` y no debe envolver una `FlatList`.
- Mantiene una superficie pequeña: solo safe area + background + `flex: 1`.

---

#### 2. `mobile/src/shared/ui/index.ts`

**Current:**
```typescript
export { AppButton } from './AppButton'
export { AppText } from './AppText'
export { Screen } from './Screen'
export { theme } from './theme'
```

**Proposed:**
```typescript
export { AppButton } from './AppButton'
export { AppText } from './AppText'
export { ListScreen } from './ListScreen'
export { Screen } from './Screen'
export { theme } from './theme'
```

---

#### 3. `mobile/src/modules/wallet/types.ts`

**Current (lines 1-9):**
```typescript
export interface Wallet {
  id: string
  currency: string
  balance: number
}

export interface WalletResponse {
  wallet: Wallet
}
```

**Proposed — append after line 9:**
```typescript
export interface TransactionCounterparty {
  wallet_id: string
  username: string
}

export interface Transaction {
  id: string
  type: 'credit' | 'debit'
  amount: number
  currency: string
  source: 'welcome_bonus' | 'manual_transfer'
  operation_id: string | null
  counterparty: TransactionCounterparty | null
  created_at: string
}

export interface TransactionsPage {
  transactions: Transaction[]
  next_cursor: string | null
}
```

**Changes:** ~21 lines added, 0 removed.

---

#### 4. `mobile/src/modules/wallet/api/walletApi.ts`

**Current (lines 19-26):**
```typescript
export async function getWallet(): Promise<Wallet> {
  try {
    const { data } = await httpClient.get<WalletResponse>('/wallet')
    return data.wallet
  } catch (error) {
    extractApiError(error)
  }
}
```

**Proposed — add import and append after line 26:**
```typescript
// Add to imports at line 3:
import type { Wallet, WalletResponse, TransactionsPage } from '../types'

// Append at end of file:
interface GetTransactionsParams {
  cursor?: string
  limit?: number
  type?: 'credit' | 'debit'
}

export async function getTransactions(params: GetTransactionsParams = {}): Promise<TransactionsPage> {
  try {
    const { data } = await httpClient.get<TransactionsPage>('/wallet/transactions', {
      params: {
        limit: params.limit ?? 20,
        ...(params.cursor !== undefined && { cursor: params.cursor }),
        ...(params.type !== undefined && { type: params.type }),
      },
    })
    return data
  } catch (error) {
    extractApiError(error)
  }
}
```

**Changes:** ~1 line modified (import), ~16 lines added.

**Rationale:**
- Reutiliza `extractApiError` y `WalletApiError` existentes
- `limit: 20` por defecto (suficiente para mobile sin sobrecargar)
- Solo agrega `cursor` al query string si está definido (primera página sin cursor)
- Solo agrega `type` cuando el filtro activo no es `all`

---

#### 5. `mobile/src/app/navigation/types.ts`

**Current (lines 6-9):**
```typescript
export type ProtectedStackParamList = {
  Wallet: undefined
  Transfer: undefined
}
```

**Proposed:**
```typescript
export type ProtectedStackParamList = {
  Wallet: undefined
  Transfer: undefined
  TransactionHistory: undefined
}
```

**Changes:** 1 line added.

---

#### 6. `mobile/src/app/navigation/RootNavigator.tsx`

**Current (lines 7-8, imports):**
```typescript
import { TransferScreen } from '../../modules/transfers/screens/TransferScreen'
import { useAuthSession } from '../../modules/auth/hooks/useAuthSession'
```

**Proposed — add after line 7:**
```typescript
import { TransferScreen } from '../../modules/transfers/screens/TransferScreen'
import { TransactionHistoryScreen } from '../../modules/wallet/screens/TransactionHistoryScreen'
import { useAuthSession } from '../../modules/auth/hooks/useAuthSession'
```

**Current (lines 23-29, ProtectedNavigator):**
```typescript
function ProtectedNavigator() {
  return (
    <ProtectedStack.Navigator screenOptions={{ headerShown: false }}>
      <ProtectedStack.Screen name="Wallet" component={WalletScreen} />
      <ProtectedStack.Screen name="Transfer" component={TransferScreen} />
    </ProtectedStack.Navigator>
  )
}
```

**Proposed:**
```typescript
function ProtectedNavigator() {
  return (
    <ProtectedStack.Navigator screenOptions={{ headerShown: false }}>
      <ProtectedStack.Screen name="Wallet" component={WalletScreen} />
      <ProtectedStack.Screen name="Transfer" component={TransferScreen} />
      <ProtectedStack.Screen name="TransactionHistory" component={TransactionHistoryScreen} />
    </ProtectedStack.Navigator>
  )
}
```

**Changes:** 2 lines added.

---

#### 7. `mobile/src/modules/wallet/screens/WalletScreen.tsx`

**Current (lines 71-74):**
```typescript
<View style={styles.actions}>
  <AppButton title="Transfer" onPress={() => navigation.navigate('Transfer')} />
</View>
```

**Proposed:**
```typescript
<View style={styles.actions}>
  <AppButton title="Transfer" onPress={() => navigation.navigate('Transfer')} />
  <AppButton
    title="Ver historial"
    variant="secondary"
    onPress={() => navigation.navigate('TransactionHistory')}
  />
</View>
```

**Changes:** 5 lines added.

---

#### 8. `mobile/src/modules/transfers/hooks/useTransfer.ts`

**Current (lines 43-46):**
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['wallet'] })
  setErrorMessage(null)
},
```

**Proposed:**
```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['wallet'] })
  queryClient.invalidateQueries({ queryKey: ['wallet', 'transactions'] })
  setErrorMessage(null)
},
```

**Changes:** 1 line added.

**Rationale:** Cuando se completa una transferencia, todas las variantes filtradas del historial quedan stale. Invalidar el prefijo `['wallet', 'transactions']` cubre `all`, `credit` y `debit`.

---

#### 9. Backend ledger transaction filter

**Files affected:**
- `backend/src/flowpay/ledger/adapters/router.py`
- `backend/src/flowpay/ledger/application/ledger_service.py`
- `backend/tests/integration/ledger/test_ledger_endpoints.py`

**Proposed behavior:**
- Add optional query param `type: credit | debit | None` to `GET /wallet/transactions`.
- Pass the filter into the ledger application service.
- Apply the filter before cursor/limit pagination so each filtered tab has correct pagination and empty states.
- Keep the router thin: validation and HTTP query parsing live in the adapter; wallet ownership and ledger retrieval remain in the ledger application path.
- Add integration coverage for `type=credit`, `type=debit`, invalid type validation, and pagination with a filtered result set.

**Rationale:** Filtering after a partially loaded mobile page can show false empty states. Server-side filtering preserves the endpoint as the source of truth for transaction history.

---

### Files NOT to Create

- No `TransactionDetailScreen` (tap en transacción)
- No componente `TransactionItem` separado (definido inline en la pantalla)
- No context/provider para historial (React Query es suficiente)

---

## Implementation Steps

### Step 1: Agregar filtro server-side al endpoint de historial

Modificar `backend/src/flowpay/ledger/adapters/router.py` y `backend/src/flowpay/ledger/application/ledger_service.py` para aceptar `type=credit|debit` y aplicar el filtro antes de paginar.

**Files affected:**
- `backend/src/flowpay/ledger/adapters/router.py`
- `backend/src/flowpay/ledger/application/ledger_service.py`
- `backend/tests/integration/ledger/test_ledger_endpoints.py`

**Verification:**
```bash
cd backend && python -m pytest tests/integration/ledger/test_ledger_endpoints.py -v
```

---

### Step 2: Crear `ListScreen` compartido para listas virtualizadas

Crear `mobile/src/shared/ui/ListScreen.tsx` y exportarlo desde `mobile/src/shared/ui/index.ts`.

**Files affected:**
- `mobile/src/shared/ui/ListScreen.tsx` (new, ~25 lines)
- `mobile/src/shared/ui/index.ts` (1 line added)

**Verification:**
```bash
cd mobile && npx tsc --noEmit
grep -n "ListScreen" mobile/src/shared/ui/index.ts mobile/src/shared/ui/ListScreen.tsx
```

---

### Step 3: Agregar tipos de transacción

Modificar `mobile/src/modules/wallet/types.ts`: agregar `TransactionCounterparty`, `Transaction`, `TransactionsPage`.

**Files affected:**
- `mobile/src/modules/wallet/types.ts` (append ~21 lines)

**Verification:**
```bash
cd mobile && npx tsc --noEmit
```

---

### Step 4: Agregar `getTransactions` al API client

Modificar `mobile/src/modules/wallet/api/walletApi.ts`: agregar import de `TransactionsPage` y función `getTransactions()` con soporte para `type`.

**Files affected:**
- `mobile/src/modules/wallet/api/walletApi.ts` (~17 lines added)

**Verification:**
```bash
cd mobile && npx tsc --noEmit
grep -n "getTransactions" mobile/src/modules/wallet/api/walletApi.ts
```

---

### Step 5: Crear `useTransactionHistory` hook

Crear `mobile/src/modules/wallet/hooks/useTransactionHistory.ts`.

**Files affected:**
- `mobile/src/modules/wallet/hooks/useTransactionHistory.ts` (new, ~55 lines)

**Verification:**
```bash
cd mobile && npx tsc --noEmit
grep -n "useInfiniteQuery" mobile/src/modules/wallet/hooks/useTransactionHistory.ts
```

---

### Step 6: Crear `TransactionHistoryScreen`

Crear `mobile/src/modules/wallet/screens/TransactionHistoryScreen.tsx` usando `ListScreen` como wrapper de safe area sin `ScrollView`.

**Files affected:**
- `mobile/src/modules/wallet/screens/TransactionHistoryScreen.tsx` (new, ~180 lines)

**Verification:**
```bash
cd mobile && npx tsc --noEmit
grep -n "FlatList" mobile/src/modules/wallet/screens/TransactionHistoryScreen.tsx
```

---

### Step 7: Actualizar navegación

Modificar `types.ts` y `RootNavigator.tsx`.

**Files affected:**
- `mobile/src/app/navigation/types.ts` (1 line added)
- `mobile/src/app/navigation/RootNavigator.tsx` (2 lines added)

**Verification:**
```bash
cd mobile && npx tsc --noEmit
grep -n "TransactionHistory" mobile/src/app/navigation/types.ts mobile/src/app/navigation/RootNavigator.tsx
```

---

### Step 8: Agregar botón "Ver historial" en WalletScreen

Modificar `WalletScreen.tsx` línea 72.

**Files affected:**
- `mobile/src/modules/wallet/screens/WalletScreen.tsx` (5 lines added)

**Verification:**
```bash
grep -n "Ver historial" mobile/src/modules/wallet/screens/WalletScreen.tsx
```

---

### Step 9: Invalidar historial en `useTransfer`

Modificar `mobile/src/modules/transfers/hooks/useTransfer.ts` línea 44.

**Files affected:**
- `mobile/src/modules/transfers/hooks/useTransfer.ts` (1 line added)

**Verification:**
```bash
grep -n "transactions" mobile/src/modules/transfers/hooks/useTransfer.ts
```

---

### Step 10: Crear tests mobile

Crear tests enfocados en los riesgos clave introducidos: shape del request API, query key por filtro y mapeo de errores. Los tests backend del filtro se agregan en Step 1.

**Files affected:**
- `mobile/src/modules/wallet/api/walletApi.test.ts` (new, ~40 lines)
- `mobile/src/modules/wallet/hooks/useTransactionHistory.test.ts` (new, ~35 lines)

**Verification:**
```bash
cd mobile && npm test -- --testPathPattern="wallet" --runInBand
```

---

### Step 11: Verificación final

```bash
cd backend && python -m pytest tests/integration/ledger/test_ledger_endpoints.py -v
cd mobile && npx tsc --noEmit && npm test -- --runInBand
```

---

## Architecture Diagram

```mermaid
graph TB
    WalletScreen -->|navigate TransactionHistory| TransactionHistoryScreen
    TransactionHistoryScreen -->|useTransactionHistory| Hook
    Hook["useTransactionHistory\nuseInfiniteQuery queryKey: ['wallet','transactions',filter]"] -->|getTransactions| walletApi
    walletApi -->|GET /wallet/transactions?type=credit/debit| httpClient
    useTransfer -->|onSuccess invalidate ['wallet','transactions']| ReactQueryCache
    TransactionHistoryScreen -->|onEndReached| Hook
    Hook -->|fetchNextPage cursor=N| walletApi
    TransactionHistoryScreen -->|filter credit/debit| ServerFilteredPages
```

---

## Scope Boundaries

### What WILL be implemented:

- `ListScreen` compartido para safe area sin `ScrollView`
- `TransactionHistoryScreen` con `FlatList` directo dentro de `ListScreen` (no `Screen`)
- Infinite scroll con `useInfiniteQuery` y `onEndReached` + `onEndReachedThreshold=0.5`
- Filtros server-side: Todas / Recibidas / Enviadas (tabs con Pressable)
- Pull-to-refresh con `RefreshControl`
- Invalidación automática de `['wallet', 'transactions']` al completar una transferencia
- Empty state: "No tienes movimientos aún"
- Label inteligente según `source` y `counterparty.username`
  - `source === 'welcome_bonus'` → "Bono de bienvenida"
  - `type === 'credit'` + counterparty → "Recibido de {username}"
  - `type === 'debit'` + counterparty → "Enviado a {username}"
- Botón "Ver historial" en WalletScreen (variant secondary)
- Back button explícito `‹ Volver` vía `navigation.goBack()` (headerShown: false)

### What will NOT be implemented:

- Agrupación por fecha (Hoy / Ayer / Esta semana)
- Detalle individual de transacción al hacer tap
- Animaciones de entrada de items
- NFC como source label (se puede agregar más adelante)
- Badge de contador en WalletScreen

### Assumptions:

- `@tanstack/react-query` expone `useInfiniteQuery` en la versión instalada (confirmado — misma versión que `useQuery`)
- `react-native-safe-area-context` está instalado (confirmado en `Screen.tsx`) y queda encapsulado detrás de wrappers de `shared/ui`
- El backend retorna transacciones en orden descendente por `created_at` (más reciente primero)
- El backend acepta `type=credit|debit` y filtra antes de paginar
- Todo usuario tiene al menos el bono de bienvenida — el empty state es para el caso de filtrado sin resultados

---

## Testing Strategy

### Unit Tests

1. **`mobile/src/modules/wallet/api/walletApi.test.ts`** (~40 lines)
   - Mock `httpClient`
   - Test: `getTransactions()` llama a `/wallet/transactions` con `limit=20` por defecto
   - Test: `cursor` se incluye en params cuando se provee
   - Test: `cursor` se omite en la primera llamada sin cursor
   - Test: `type` se incluye cuando el filtro es `credit` o `debit`

2. **`mobile/src/modules/wallet/hooks/useTransactionHistory.test.ts`** (~35 lines)
   - Test: `mapTransactionError` con `wallet_not_found` → "Billetera no encontrada"
   - Test: error genérico → "Error de conexión. Intenta de nuevo."
   - Test: el hook usa query key `['wallet', 'transactions', filter]`

3. **`backend/tests/integration/ledger/test_ledger_endpoints.py`**
   - Test: `type=credit` retorna solo créditos y mantiene paginación
   - Test: `type=debit` retorna solo débitos y mantiene paginación
   - Test: `type` inválido retorna error de validación

### Manual Testing

```
1. Login → WalletScreen → "Ver historial"
   → Ver bono de bienvenida COP 50.000 con label "Bono de bienvenida"

2. Filtrar "Enviadas" → lista vacía con empty state si no existen débitos en backend

3. Filtrar "Recibidas" → bono visible

4. Volver → hacer transfer → volver a historial
   → Transfer aparece en "Enviadas"

5. Pull-to-refresh → lista recarga desde página 0

6. Con 25+ transacciones → scroll al fondo → carga más (spinner + nuevos items)
```

---

## Rollback Plan

1. `git revert <commit>` — elimina archivos nuevos y revierte modificaciones
2. WalletScreen pierde el botón "Ver historial" (no visible al usuario)
3. Sin impacto en base de datos ni migraciones; el endpoint vuelve al contrato anterior sin `type`

---

## Success Criteria

- [ ] Botón "Ver historial" en WalletScreen navega a la pantalla
- [ ] Bono de bienvenida aparece con label "Bono de bienvenida" y monto `+COP 50.000`
- [ ] Filtros Todas / Recibidas / Enviadas consultan páginas filtradas desde backend
- [ ] Scroll al fondo con `next_cursor` presente dispara `fetchNextPage`
- [ ] Scroll al fondo sin `next_cursor` no dispara más fetches
- [ ] Pull-to-refresh recarga desde página 0
- [ ] Después de una transferencia, al volver al historial la nueva transacción aparece
- [ ] Empty state visible cuando el filtro activo no tiene resultados
- [ ] Tests backend cubren `type=credit`, `type=debit` y `type` inválido
- [ ] TypeScript compila sin errores (`npx tsc --noEmit`)
- [ ] Tests mobile pasan (`npm test`)

---

## TL;DR

| Aspecto | Detalle |
|---------|---------|
| **Archivos a crear** | 5 mobile (ListScreen, TransactionHistoryScreen, useTransactionHistory, walletApi.test.ts, useTransactionHistory.test.ts) |
| **Archivos a modificar** | 10 (backend router/service/test + mobile shared/ui index, types, walletApi, RootNavigator, navigation/types, WalletScreen, useTransfer) |
| **Líneas agregadas** | ~395 (ListScreen ~25 + screen ~180 + hook ~60 + api ~20 + types ~21 + nav ~3 + wallet ~5 + transfer ~1 + mobile tests ~85 + backend filter/tests ~60) |
| **Líneas modificadas** | ~11 |
| **Líneas eliminadas** | 0 |
| **Key deliverables** | Historial paginado con infinite scroll, filtros server-side Todas/Recibidas/Enviadas, invalidación automática al transferir |
| **NOT incluido** | Detalle de transacción, agrupación por fecha, animaciones |

## Team TL;DR

**What we're building:** Una pantalla de historial de transacciones donde el usuario ve todos sus movimientos (bono de bienvenida, transferencias enviadas y recibidas), puede filtrar por tipo, y hace scroll para cargar más automáticamente.

**Why it matters:** Sin historial, el usuario no puede verificar si una transferencia llegó, revisar su actividad pasada, o tener confianza en el saldo mostrado. Es una feature de confianza básica para cualquier app de dinero.

**Timeline impact:** Feature independiente, no bloquea ni es bloqueada por NFC. El historial se actualiza automáticamente cada vez que se hace una transferencia.
