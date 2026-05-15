import React from 'react'
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, ViewStyle, GestureResponderEvent } from 'react-native'
import { theme } from './theme'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

type AppButtonProps = {
  title: string
  onPress: (event: GestureResponderEvent) => void
  variant?: ButtonVariant
  disabled?: boolean
  loading?: boolean
  style?: StyleProp<ViewStyle>
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 52,
    marginVertical: theme.spacing.sm,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
  },
  primaryButtonPressed: {
    backgroundColor: theme.colors.primaryPressed,
  },
  primaryButtonDisabled: {
    backgroundColor: theme.colors.primary,
    opacity: 0.5,
  },
  primaryText: {
    color: theme.colors.primaryText,
    fontSize: theme.typography.body,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: theme.colors.primaryTint,
    borderWidth: 1,
    borderColor: theme.colors.primaryTint,
  },
  secondaryButtonPressed: {
    backgroundColor: theme.colors.surfaceMuted,
  },
  secondaryButtonDisabled: {
    opacity: 0.5,
    borderColor: theme.colors.primary,
  },
  secondaryText: {
    color: theme.colors.primary,
    fontSize: theme.typography.body,
    fontWeight: '600',
  },
  dangerButton: {
    backgroundColor: theme.colors.dangerTint,
  },
  dangerButtonPressed: {
    backgroundColor: theme.colors.dangerPressed,
  },
  dangerButtonDisabled: {
    backgroundColor: theme.colors.danger,
    opacity: 0.5,
  },
  dangerText: {
    color: theme.colors.danger,
    fontSize: theme.typography.body,
    fontWeight: '600',
  },
  ghostButton: {
    backgroundColor: 'transparent',
  },
  ghostButtonPressed: {
    backgroundColor: theme.colors.surfaceMuted,
  },
  ghostText: {
    color: theme.colors.primary,
    fontSize: theme.typography.body,
    fontWeight: '600',
  },
  textContent: {
    marginHorizontal: theme.spacing.sm,
  },
})

export function AppButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
}: AppButtonProps) {
  const isDisabled = disabled || loading

  const getButtonStyle = () => {
    const baseStyle = styles.button
    if (variant === 'primary') {
      return [baseStyle, isDisabled ? styles.primaryButtonDisabled : styles.primaryButton]
    }
    if (variant === 'secondary') {
      return [baseStyle, isDisabled ? styles.secondaryButtonDisabled : styles.secondaryButton]
    }
    if (variant === 'danger') {
      return [baseStyle, isDisabled ? styles.dangerButtonDisabled : styles.dangerButton]
    }
    if (variant === 'ghost') {
      return [baseStyle, styles.ghostButton, isDisabled && { opacity: 0.5 }]
    }
    return baseStyle
  }

  const getTextStyle = () => {
    if (variant === 'primary') return styles.primaryText
    if (variant === 'secondary') return styles.secondaryText
    if (variant === 'danger') return styles.dangerText
    if (variant === 'ghost') return styles.ghostText
    return styles.primaryText
  }

  return (
    <Pressable
      style={({ pressed }) => [
        getButtonStyle(),
        pressed && !isDisabled && {
          backgroundColor:
            variant === 'primary'
              ? theme.colors.primaryPressed
              : variant === 'secondary'
                ? theme.colors.surfaceMuted
                : variant === 'ghost'
                  ? theme.colors.surfaceMuted
                  : theme.colors.dangerTint,
        },
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
    >
      {loading && <ActivityIndicator color={variant === 'secondary' ? theme.colors.primary : theme.colors.primaryText} />}
      <Text style={[getTextStyle(), loading && styles.textContent]}>{title}</Text>
    </Pressable>
  )
}
