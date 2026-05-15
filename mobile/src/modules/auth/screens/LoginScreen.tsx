import React, { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { PublicStackParamList } from '../../../app/navigation/types'
import { Screen, AppText, TextField, AppButton, BrandLogo, theme } from '../../../shared/ui'
import { useLogin } from '../hooks/useLogin'

type Nav = NativeStackNavigationProp<PublicStackParamList, 'Login'>

export function LoginScreen() {
  const navigation = useNavigation<Nav>()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const { submit, isLoading, error } = useLogin()

  return (
    <Screen centered keyboardAware>
      <View style={styles.brand}>
        <BrandLogo size="large" />
        <AppText variant="title" style={styles.title}>
          Entra a tu cuenta
        </AppText>
        <AppText variant="muted" style={styles.subtitle}>
          Envía y recibe plata de forma simple.
        </AppText>
      </View>

      <View style={styles.formCard}>
        <TextField
          placeholder="Usuario"
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
          editable={!isLoading}
        />
        <TextField
          placeholder="Contraseña"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!isLoading}
        />
        {error ? <AppText variant="error" style={styles.error}>{error}</AppText> : null}
        <AppButton title="Entrar" onPress={() => submit(username, password)} loading={isLoading} style={styles.action} />
        <AppButton title="Crear cuenta" variant="secondary" onPress={() => navigation.navigate('Register')} />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  brand: { marginBottom: theme.spacing.xl, width: '100%' },
  title: { marginTop: theme.spacing.xl, marginBottom: theme.spacing.xs },
  subtitle: { maxWidth: 280 },
  formCard: {
    width: '100%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    ...theme.shadow.card,
  },
  error: { marginBottom: theme.spacing.sm },
  action: { marginVertical: theme.spacing.md },
})
