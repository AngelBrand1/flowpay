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
    fontWeight: '800',
    color: theme.colors.text,
    lineHeight: 36,
  },
  subtitle: {
    fontSize: theme.typography.subtitle,
    fontWeight: '700',
    color: theme.colors.text,
    lineHeight: 24,
  },
  body: {
    fontSize: theme.typography.body,
    fontWeight: '400',
    color: theme.colors.text,
    lineHeight: 22,
  },
  muted: {
    fontSize: theme.typography.body,
    fontWeight: '400',
    color: theme.colors.mutedText,
    lineHeight: 22,
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
