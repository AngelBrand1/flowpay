import React, { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { PublicStackParamList } from '../../../app/navigation/types'
import { Screen, AppText, TextField, AppButton, BrandLogo, theme } from '../../../shared/ui'
import { useRegister } from '../hooks/useRegister'

type Nav = NativeStackNavigationProp<PublicStackParamList, 'Register'>

export function RegisterScreen() {
  const navigation = useNavigation<Nav>()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const { submit, isLoading, error } = useRegister()

  return (
    <Screen centered keyboardAware>
      <View style={styles.brand}>
        <BrandLogo size="large" />
        <AppText variant="title" style={styles.title}>
          Crea tu cuenta
        </AppText>
        <AppText variant="muted" style={styles.subtitle}>
          Solo necesitas usuario y contraseña para probar la app.
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
        <AppButton title="Crear cuenta" onPress={() => submit(username, password)} loading={isLoading} style={styles.action} />
        <AppButton title="Ya tengo cuenta" variant="secondary" onPress={() => navigation.goBack()} />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  brand: { marginBottom: theme.spacing.xl, width: '100%' },
  title: { marginTop: theme.spacing.xl, marginBottom: theme.spacing.xs },
  subtitle: { maxWidth: 300 },
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
