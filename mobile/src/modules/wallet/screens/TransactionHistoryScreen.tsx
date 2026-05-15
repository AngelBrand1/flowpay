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
  return `${sign} ${amount.toLocaleString('es-CO')}`
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function getLabel(tx: Transaction): string {
  if (tx.source === 'welcome_bonus') return 'Bono de bienvenida'
  if (tx.source === 'topup') return 'Recarga de saldo'
  if (tx.source === 'nfc_transfer' || tx.source === 'manual_transfer') {
    if (tx.counterparty?.username) {
      return tx.type === 'credit'
        ? `${tx.counterparty.username} te envió`
        : `Enviaste a ${tx.counterparty.username}`
    }
  }
  return tx.type === 'credit' ? 'Entrada de plata' : 'Salida de plata'
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
        <AppText variant="body" style={styles.itemLabel}>
          {getLabel(item)}
        </AppText>
        <AppText variant="muted" style={styles.itemDate}>
          {formatDate(item.created_at)}
        </AppText>
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
  { label: 'Todo', value: 'all' },
  { label: 'Entradas', value: 'credit' },
  { label: 'Salidas', value: 'debit' },
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
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
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
              Aún no tienes movimientos
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
        <AppText style={styles.backText}>‹ Inicio</AppText>
      </Pressable>
      <AppText variant="title" style={styles.title}>
        Movimientos
      </AppText>
      <AppText variant="muted" style={styles.subtitle}>
        Todo lo que entra y sale de tu cuenta.
      </AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
  backButton: { marginBottom: theme.spacing.sm },
  backText: { color: theme.colors.primary, fontSize: theme.typography.body, fontWeight: '700' },
  title: {},
  subtitle: { marginTop: theme.spacing.xs },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  filterTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.primaryTint,
    backgroundColor: theme.colors.surface,
  },
  filterTabActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterLabel: { fontSize: theme.typography.small, color: theme.colors.mutedText, fontWeight: '700' },
  filterLabelActive: { color: theme.colors.primaryText, fontWeight: '600' },
  list: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  listEmpty: { flex: 1 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.md,
    ...theme.shadow.card,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  creditBadge: { backgroundColor: theme.colors.successTint },
  debitBadge: { backgroundColor: theme.colors.accentTint },
  iconText: { fontSize: 18, fontWeight: '700' },
  creditText: { color: theme.colors.success },
  debitText: { color: theme.colors.danger },
  itemInfo: { flex: 1 },
  itemLabel: { fontWeight: '500' },
  itemDate: { fontSize: theme.typography.small, marginTop: theme.spacing.xs },
  itemAmount: { textAlign: 'right', minWidth: 88 },
  creditAmount: { color: theme.colors.success },
  debitAmount: { color: theme.colors.danger },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { textAlign: 'center' },
  loader: { paddingVertical: theme.spacing.lg },
})
