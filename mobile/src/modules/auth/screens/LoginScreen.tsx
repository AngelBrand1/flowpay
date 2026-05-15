import React, { useState } from 'react'
import { ActivityIndicator, Button, StyleSheet, Text, TextInput, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { PublicStackParamList } from '../../../app/navigation/types'
import { useLogin } from '../hooks/useLogin'

type Nav = NativeStackNavigationProp<PublicStackParamList, 'Login'>

export function LoginScreen() {
  const navigation = useNavigation<Nav>()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const { submit, isLoading, error } = useLogin()

  return (
    <View style={styles.container}>
      <Text style={styles.title}>FlowPay</Text>
      <TextInput
        style={styles.input}
        placeholder="Usuario"
        autoCapitalize="none"
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {isLoading ? (
        <ActivityIndicator style={styles.action} />
      ) : (
        <Button title="Entrar" onPress={() => submit(username, password)} />
      )}
      <Button title="Crear cuenta" onPress={() => navigation.navigate('Register')} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 32, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
  error: { color: 'red', marginBottom: 12 },
  action: { marginVertical: 8 },
})
