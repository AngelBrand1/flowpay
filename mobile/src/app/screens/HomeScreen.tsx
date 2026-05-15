import React from 'react'
import { StyleSheet } from 'react-native'
import { Screen, AppText, AppButton, theme } from '../../shared/ui'
import { useAuthSession } from '../../modules/auth/hooks/useAuthSession'

export function HomeScreen() {
  const { user, logout } = useAuthSession()

  return (
    <Screen centered>
      <AppText variant="title" style={styles.title}>
        FlowPay
      </AppText>
      <AppText variant="subtitle" style={styles.subtitle}>
        Bienvenido, {user?.username}
      </AppText>
      <AppButton title="Cerrar sesión" variant="danger" onPress={logout} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  title: { marginBottom: theme.spacing.lg, textAlign: 'center' },
  subtitle: { marginBottom: theme.spacing.xxl, textAlign: 'center' },
})
