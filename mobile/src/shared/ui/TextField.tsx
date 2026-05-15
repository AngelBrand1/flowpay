import React from 'react'
import { StyleSheet, TextInput, TextInputProps } from 'react-native'
import { theme } from './theme'

type TextFieldProps = TextInputProps & {
  error?: boolean
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.md,
    fontSize: theme.typography.body,
    color: theme.colors.text,
  },
  inputError: {
    borderColor: theme.colors.danger,
  },
})

export function TextField({ error, style, ...props }: TextFieldProps) {
  return (
    <TextInput
      style={[styles.input, error && styles.inputError, style]}
      placeholderTextColor={theme.colors.mutedText}
      {...props}
    />
  )
}
