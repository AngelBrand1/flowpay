import React from 'react'
import { Button, StyleSheet, Text, View } from 'react-native'
import { useAuthSession } from '../../modules/auth/hooks/useAuthSession'

export function HomeScreen() {
  const { user, logout } = useAuthSession()

  return (
    <View style={styles.container}>
      <Text style={styles.title}>FlowPay</Text>
      <Text style={styles.subtitle}>Bienvenido, {user?.username}</Text>
      <Button title="Cerrar sesión" onPress={logout} color="#dc2626" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 16 },
  subtitle: { fontSize: 18, marginBottom: 32, textAlign: 'center' },
})
