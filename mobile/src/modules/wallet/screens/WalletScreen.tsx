import React from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { ProtectedStackParamList } from '../../../app/navigation/types'
import { AppButton, AppText, Screen, theme } from '../../../shared/ui'
import { useAuthSession } from '../../auth/hooks/useAuthSession'
import { useWallet } from '../hooks/useWallet'

type Nav = NativeStackNavigationProp<ProtectedStackParamList, 'Wallet'>

function formatBalance(balance: number, currency: string): string {
  return `${currency} ${balance.toLocaleString('es-CO')}`
}

function formatWalletId(walletId: string): string {
  if (walletId.length <= 14) return walletId
  return `${walletId.slice(0, 8)}...${walletId.slice(-6)}`
}

export function WalletScreen() {
  const navigation = useNavigation<Nav>()
  const { user, logout } = useAuthSession()
  const { wallet, isLoading, error, refetch } = useWallet()

  if (isLoading) {
    return (
      <Screen centered>
        <ActivityIndicator />
      </Screen>
    )
  }

  if (error || !wallet) {
    return (
      <Screen centered>
        <AppText variant="error" style={styles.errorText}>
          {error ?? 'Error loading wallet'}
        </AppText>
        <AppButton title="Retry" onPress={() => refetch()} style={styles.retryButton} />
        <AppButton title="Logout" variant="danger" onPress={logout} />
      </Screen>
    )
  }

  return (
    <Screen contentStyle={styles.content}>
      <View>
        <View style={styles.header}>
          <AppText variant="title" style={styles.appTitle}>
            FlowPay
          </AppText>
          <AppText variant="muted">{user?.username}</AppText>
        </View>

        <View style={styles.walletCard}>
          <AppText variant="muted" style={styles.balanceLabel}>
            Available balance
          </AppText>
          <AppText variant="title" style={styles.balanceAmount}>
            {formatBalance(wallet.balance, wallet.currency)}
          </AppText>
          <AppText variant="muted" style={styles.walletIdLabel}>
            Wallet
          </AppText>
          <AppText variant="muted" style={styles.walletId}>
            {formatWalletId(wallet.id)}
          </AppText>
        </View>

        <View style={styles.actions}>
          <AppButton title="Transfer" onPress={() => navigation.navigate('Transfer')} />
          <AppButton
            title="Ver historial"
            variant="secondary"
            onPress={() => navigation.navigate('TransactionHistory')}
          />
        </View>
      </View>

      <AppButton title="Logout" variant="danger" onPress={logout} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'space-between' },
  header: { alignItems: 'center', paddingTop: theme.spacing.xl, marginBottom: theme.spacing.xxl },
  appTitle: { marginBottom: theme.spacing.sm },
  walletCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    marginBottom: theme.spacing.xxl,
  },
  balanceLabel: { marginBottom: theme.spacing.sm },
  balanceAmount: { marginBottom: theme.spacing.md },
  walletIdLabel: { fontSize: theme.typography.small, marginBottom: theme.spacing.xs },
  walletId: { fontSize: theme.typography.small },
  actions: { gap: theme.spacing.sm, marginBottom: theme.spacing.xxl },
  errorText: { marginBottom: theme.spacing.lg, textAlign: 'center' },
  retryButton: { marginBottom: theme.spacing.md },
})
