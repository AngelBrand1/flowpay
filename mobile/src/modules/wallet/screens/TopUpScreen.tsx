import React, { useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { ProtectedStackParamList } from '../../../app/navigation/types'
import { AppButton, AppText, TextField, Screen, theme } from '../../../shared/ui'
import { useTopUp } from '../hooks/useTopUp'
import type { Transaction } from '../types'

type Nav = NativeStackNavigationProp<ProtectedStackParamList, 'TopUp'>
type TopUpStep = 'amount' | 'confirm' | 'success' | 'error'

function formatAmount(amount: number): string {
  return amount.toLocaleString('es-CO')
}

function parseAmount(value: string): number | null {
  const normalized = value.trim()
  if (!/^[1-9]\d*$/.test(normalized)) return null
  const amount = Number(normalized)
  if (!Number.isSafeInteger(amount)) return null
  return amount
}

const MAX_TOPUP = 1_000_000

export function TopUpScreen() {
  const navigation = useNavigation<Nav>()
  const { isLoading, error, submit } = useTopUp()

  const [step, setStep] = useState<TopUpStep>('amount')
  const [amount, setAmount] = useState('')
  const [amountError, setAmountError] = useState<string | null>(null)
  const [confirmedTransaction, setConfirmedTransaction] = useState<Transaction | null>(null)

  if (isLoading) {
    return (
      <Screen centered>
        <ActivityIndicator />
        <AppText variant="body" style={styles.loadingText}>
          Processing top-up...
        </AppText>
      </Screen>
    )
  }

  if (step === 'success' && confirmedTransaction) {
    return (
      <Screen centered>
        <AppText variant="title" style={styles.successTitle}>
          Top-up successful
        </AppText>
        <View style={styles.detailCard}>
          <AppText style={styles.label}>Amount loaded</AppText>
          <AppText variant="subtitle" style={styles.value}>
            COP {formatAmount(confirmedTransaction.amount)}
          </AppText>
        </View>
        <AppButton
          title="Back to my wallet"
          onPress={() => navigation.navigate('Wallet')}
          style={styles.actionButton}
        />
      </Screen>
    )
  }

  if (step === 'error') {
    return (
      <Screen centered>
        <AppText variant="error" style={styles.errorTitle}>
          Top-up error
        </AppText>
        <AppText variant="body" style={styles.errorMessage}>
          {error}
        </AppText>
        <AppButton
          title="Retry"
          onPress={async () => {
            const numAmount = parseAmount(amount)
            if (numAmount === null) {
              setStep('amount')
              return
            }
            try {
              const result = await submit(numAmount)
              setConfirmedTransaction(result)
              setStep('success')
            } catch {
              setStep('error')
            }
          }}
          disabled={isLoading}
          loading={isLoading}
          style={styles.actionButton}
        />
        <AppButton
          title="Cancel"
          variant="secondary"
          onPress={() => navigation.navigate('Wallet')}
        />
      </Screen>
    )
  }

  if (step === 'amount') {
    return (
      <Screen centered keyboardAware>
        <AppText variant="title" style={styles.stepTitle}>
          How much do you want to load?
        </AppText>
        <TextField
          placeholder="Amount in COP"
          keyboardType="number-pad"
          value={amount}
          onChangeText={(text) => {
            setAmount(text)
            setAmountError(null)
          }}
          editable={!isLoading}
        />
        {amountError && (
          <AppText variant="error" style={styles.amountErrorText}>
            {amountError}
          </AppText>
        )}
        <AppButton
          title="Next"
          onPress={() => {
            const parsedAmount = parseAmount(amount)
            if (parsedAmount === null || parsedAmount > MAX_TOPUP) {
              setAmountError(`Enter an amount between 1 and ${formatAmount(MAX_TOPUP)} COP`)
              return
            }
            setAmount(String(parsedAmount))
            setStep('confirm')
          }}
          disabled={!amount.trim()}
          style={styles.actionButton}
        />
        <AppButton
          title="Cancel"
          variant="secondary"
          onPress={() => navigation.navigate('Wallet')}
        />
      </Screen>
    )
  }

  if (step === 'confirm') {
    const numAmount = parseAmount(amount)
    if (numAmount === null) {
      return (
        <Screen centered>
          <AppText variant="error" style={styles.errorMessage}>
            Enter a valid quantity greater than 0
          </AppText>
          <AppButton title="Back to amount" onPress={() => setStep('amount')} />
        </Screen>
      )
    }

    return (
      <Screen centered contentStyle={styles.confirmContent}>
        <View>
          <AppText variant="title" style={styles.confirmTitle}>
            Confirm your top-up
          </AppText>
          <View style={styles.confirmCard}>
            <AppText style={styles.label}>Amount to load</AppText>
            <AppText variant="subtitle" style={styles.value}>
              COP {formatAmount(numAmount)}
            </AppText>
          </View>
        </View>

        <View style={styles.actions}>
          <AppButton
            title="Top up balance"
            onPress={async () => {
              try {
                const result = await submit(numAmount)
                setConfirmedTransaction(result)
                setStep('success')
              } catch {
                setStep('error')
              }
            }}
            disabled={isLoading}
            loading={isLoading}
            style={styles.confirmButton}
          />
          <AppButton
            title="Back"
            variant="secondary"
            onPress={() => setStep('amount')}
            disabled={isLoading}
          />
        </View>
      </Screen>
    )
  }

  return null
}

const styles = StyleSheet.create({
  stepTitle: {
    marginBottom: theme.spacing.xxl,
    textAlign: 'center',
  },
  actionButton: {
    marginVertical: theme.spacing.md,
  },
  amountErrorText: {
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  confirmTitle: {
    marginBottom: theme.spacing.xl,
    textAlign: 'center',
  },
  confirmContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  confirmCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xxl,
    alignItems: 'center',
  },
  label: {
    fontSize: theme.typography.small,
    color: theme.colors.mutedText,
    marginBottom: theme.spacing.xs,
  },
  value: {
    marginBottom: theme.spacing.md,
  },
  actions: {
    gap: theme.spacing.sm,
  },
  confirmButton: {
    marginBottom: theme.spacing.md,
  },
  successTitle: {
    marginBottom: theme.spacing.xxl,
    textAlign: 'center',
    color: theme.colors.success,
  },
  detailCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xxl,
    width: '100%',
    alignItems: 'center',
  },
  errorTitle: {
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  errorMessage: {
    marginBottom: theme.spacing.xl,
    textAlign: 'center',
    color: theme.colors.danger,
  },
  loadingText: {
    marginTop: theme.spacing.lg,
    textAlign: 'center',
  },
})
