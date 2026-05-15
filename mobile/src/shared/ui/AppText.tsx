import React from 'react'
import { StyleSheet, Text, TextProps } from 'react-native'
import { theme } from './theme'

type TextVariant = 'title' | 'subtitle' | 'body' | 'muted' | 'error'

type AppTextProps = TextProps & {
  variant?: TextVariant
}

const styles = StyleSheet.create({
  title: {
    fontSize: theme.typography.title,
    fontWeight: '700',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: theme.typography.subtitle,
    fontWeight: '600',
    color: theme.colors.text,
  },
  body: {
    fontSize: theme.typography.body,
    fontWeight: '400',
    color: theme.colors.text,
  },
  muted: {
    fontSize: theme.typography.body,
    fontWeight: '400',
    color: theme.colors.mutedText,
  },
  error: {
    fontSize: theme.typography.small,
    fontWeight: '400',
    color: theme.colors.danger,
  },
})

export function AppText({ variant = 'body', style, ...props }: AppTextProps) {
  return <Text style={[styles[variant], style]} {...props} />
}
