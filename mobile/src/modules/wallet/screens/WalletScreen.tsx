import React from 'react'
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { ProtectedStackParamList } from '../../../app/navigation/types'
import { AppButton, AppText, BrandLogo, Screen, theme } from '../../../shared/ui'
import { useAuthSession } from '../../auth/hooks/useAuthSession'
import { useWallet } from '../hooks/useWallet'

type Nav = NativeStackNavigationProp<ProtectedStackParamList, 'Wallet'>

function formatBalance(balance: number, currency: string): string {
  return `${currency} ${balance.toLocaleString('es-CO')}`
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
          {error ?? 'No pudimos cargar tu cuenta'}
        </AppText>
        <AppButton title="Intentar de nuevo" onPress={() => refetch()} style={styles.retryButton} />
        <AppButton title="Cerrar sesión" variant="ghost" onPress={logout} />
      </Screen>
    )
  }

  return (
    <Screen contentStyle={styles.content}>
      <View>
        <View style={styles.header}>
          <BrandLogo />
          <AppText variant="title" style={styles.greeting}>
            Hola, {user?.username ?? 'usuario'}
          </AppText>
          <AppText variant="muted" style={styles.headerCopy}>
            Maneja tus pagos desde un solo lugar.
          </AppText>
        </View>

        <View style={styles.walletCard}>
          <AppText variant="muted" style={styles.balanceLabel}>
            Disponible
          </AppText>
          <AppText variant="title" style={styles.balanceAmount}>
            {formatBalance(wallet.balance, wallet.currency)}
          </AppText>
          <AppText variant="muted" style={styles.balanceHint}>
            Tu dinero listo para enviar.
          </AppText>
        </View>

        <View style={styles.actions}>
          <QuickAction
            icon="↑"
            title="Enviar plata"
            description="A una persona o por NFC"
            onPress={() => navigation.navigate('Transfer')}
          />
          <QuickAction
            icon="+"
            title="Recargar"
            description="Agrega saldo a tu cuenta"
            onPress={() => navigation.navigate('TopUp')}
          />
          <QuickAction
            icon="≡"
            title="Movimientos"
            description="Revisa lo que entra y sale"
            onPress={() => navigation.navigate('TransactionHistory')}
          />
        </View>
      </View>

      <AppButton title="Cerrar sesión" variant="ghost" onPress={logout} />
    </Screen>
  )
}

function QuickAction({
  icon,
  title,
  description,
  onPress,
}: {
  icon: string
  title: string
  description: string
  onPress: () => void
}) {
  return (
    <Pressable style={styles.quickAction} onPress={onPress}>
      <View style={styles.quickIcon}>
        <AppText style={styles.quickIconText}>{icon}</AppText>
      </View>
      <View style={styles.quickText}>
        <AppText variant="subtitle">{title}</AppText>
        <AppText variant="muted" style={styles.quickDescription}>
          {description}
        </AppText>
      </View>
      <AppText style={styles.quickArrow}>›</AppText>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'space-between' },
  header: { paddingTop: theme.spacing.lg, marginBottom: theme.spacing.xl },
  greeting: { marginTop: theme.spacing.xl, marginBottom: theme.spacing.xs },
  headerCopy: { maxWidth: 280 },
  walletCard: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
    ...theme.shadow.card,
  },
  balanceLabel: {
    marginBottom: theme.spacing.sm,
    color: '#cfe9e5',
    fontWeight: '600',
  },
  balanceAmount: {
    marginBottom: theme.spacing.md,
    color: theme.colors.primaryText,
  },
  balanceHint: { color: '#cfe9e5' },
  actions: { gap: theme.spacing.md, marginBottom: theme.spacing.xl },
  quickAction: {
    minHeight: 78,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    ...theme.shadow.card,
  },
  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickIconText: {
    color: theme.colors.primary,
    fontSize: 22,
    fontWeight: '800',
  },
  quickText: { flex: 1 },
  quickDescription: { fontSize: theme.typography.small, marginTop: theme.spacing.xs },
  quickArrow: {
    color: theme.colors.primary,
    fontSize: 28,
    fontWeight: '700',
  },
  errorText: { marginBottom: theme.spacing.lg, textAlign: 'center' },
  retryButton: { marginBottom: theme.spacing.md },
})
