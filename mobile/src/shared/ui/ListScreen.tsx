import React from 'react'
import { StyleProp, StyleSheet, ViewStyle } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { theme } from './theme'

type ListScreenProps = {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
}

export function ListScreen({ children, style }: ListScreenProps) {
  return <SafeAreaView style={[styles.container, style]}>{children}</SafeAreaView>
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
})
