import React, { useState } from 'react'
import { StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { PublicStackParamList } from '../../../app/navigation/types'
import { Screen, AppText, TextField, AppButton, theme } from '../../../shared/ui'
import { useLogin } from '../hooks/useLogin'

type Nav = NativeStackNavigationProp<PublicStackParamList, 'Login'>

export function LoginScreen() {
  const navigation = useNavigation<Nav>()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const { submit, isLoading, error } = useLogin()

  return (
    <Screen centered keyboardAware>
      <AppText variant="title" style={styles.title}>
        FlowPay
      </AppText>
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
      {error ? <AppText variant="error">{error}</AppText> : null}
      <AppButton title="Entrar" onPress={() => submit(username, password)} loading={isLoading} style={styles.action} />
      <AppButton title="Crear cuenta" variant="secondary" onPress={() => navigation.navigate('Register')} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  title: { marginBottom: theme.spacing.xxl, textAlign: 'center' },
  action: { marginVertical: theme.spacing.md },
})
