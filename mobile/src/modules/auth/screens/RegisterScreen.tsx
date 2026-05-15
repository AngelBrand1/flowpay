import React, { useState } from 'react'
import { ActivityIndicator, Button, StyleSheet, Text, TextInput, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { PublicStackParamList } from '../../../app/navigation/types'
import { useRegister } from '../hooks/useRegister'

type Nav = NativeStackNavigationProp<PublicStackParamList, 'Register'>

export function RegisterScreen() {
  const navigation = useNavigation<Nav>()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const { submit, isLoading, error } = useRegister()

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Crear cuenta</Text>
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
        <Button title="Crear cuenta" onPress={() => submit(username, password)} />
      )}
      <Button title="Ya tengo cuenta" onPress={() => navigation.goBack()} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 32, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
  error: { color: 'red', marginBottom: 12 },
  action: { marginVertical: 8 },
})
