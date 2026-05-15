import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { theme } from './theme'

type BrandLogoProps = {
  size?: 'compact' | 'large'
}

export function BrandLogo({ size = 'compact' }: BrandLogoProps) {
  const isLarge = size === 'large'

  return (
    <View style={styles.container}>
      <View style={[styles.mark, isLarge && styles.markLarge]}>
        <Text style={[styles.markText, isLarge && styles.markTextLarge]}>F</Text>
      </View>
      <Text style={[styles.wordmark, isLarge && styles.wordmarkLarge]}>
        Flow<Text style={styles.wordmarkAccent}>Pay</Text>
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  mark: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markLarge: {
    width: 44,
    height: 44,
    borderRadius: 16,
  },
  markText: {
    color: theme.colors.primaryText,
    fontSize: 20,
    fontWeight: '900',
  },
  markTextLarge: {
    fontSize: 26,
  },
  wordmark: {
    color: theme.colors.text,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0,
  },
  wordmarkLarge: {
    fontSize: 34,
  },
  wordmarkAccent: {
    color: theme.colors.accent,
  },
})
