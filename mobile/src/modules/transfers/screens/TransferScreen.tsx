import React, { useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { ProtectedStackParamList } from '../../../app/navigation/types'
import { AppButton, AppText, TextField, Screen, theme } from '../../../shared/ui'
import { useTransfer } from '../hooks/useTransfer'
import type { Transfer } from '../types'

type Nav = NativeStackNavigationProp<ProtectedStackParamList, 'Transfer'>

type TransferStep = 'recipient' | 'amount' | 'confirm' | 'success' | 'error'

function createIdempotencyKey(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }

  return `transfer_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

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

export function TransferScreen() {
  const navigation = useNavigation<Nav>()
  const { isLoading, error, submit } = useTransfer()

  const [step, setStep] = useState<TransferStep>('recipient')
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [amountError, setAmountError] = useState<string | null>(null)
  const [idempotencyKey, setIdempotencyKey] = useState(() => createIdempotencyKey())
  const [confirmedTransfer, setConfirmedTransfer] = useState<Transfer | null>(null)

  if (step === 'success' && confirmedTransfer) {
    return (
      <Screen centered>
        <AppText variant="title" style={styles.successTitle}>
          Transferencia exitosa
        </AppText>
        <View style={styles.successDetails}>
          <AppText style={styles.label}>Destinatario</AppText>
          <AppText variant="subtitle" style={styles.value}>
            {recipient}
          </AppText>
          <AppText style={styles.label}>Monto</AppText>
          <AppText variant="subtitle" style={styles.value}>
            COP {formatAmount(confirmedTransfer.amount)}
          </AppText>
          <AppText style={styles.label}>ID Operación</AppText>
          <AppText style={styles.operationId}>
            {confirmedTransfer.id.slice(0, 20)}...
          </AppText>
        </View>
        <AppButton
          title="Volver a mi billetera"
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
          Error en la transferencia
        </AppText>
        <AppText variant="body" style={styles.errorMessage}>
          {error}
        </AppText>
        <AppButton
          title="Reintentar"
          onPress={async () => {
            const numAmount = parseAmount(amount)
            if (numAmount === null) {
              setStep('amount')
              return
            }

            try {
              const result = await submit({
                destinationUsername: recipient.trim(),
                amount: numAmount,
                idempotencyKey,
              })
              setConfirmedTransfer(result)
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
          title="Editar datos"
          variant="secondary"
          onPress={() => {
            setStep('recipient')
            setAmountError(null)
            setIdempotencyKey(createIdempotencyKey())
            setConfirmedTransfer(null)
          }}
        />
        <AppButton
          title="Cancelar"
          variant="secondary"
          onPress={() => {
            setIdempotencyKey(createIdempotencyKey())
            setConfirmedTransfer(null)
            navigation.navigate('Wallet')
          }}
        />
      </Screen>
    )
  }

  if (isLoading) {
    return (
      <Screen centered>
        <ActivityIndicator />
        <AppText variant="body" style={styles.loadingText}>
          Procesando transferencia...
        </AppText>
      </Screen>
    )
  }

  if (step === 'recipient') {
    return (
      <Screen centered keyboardAware>
        <AppText variant="title" style={styles.stepTitle}>
          ¿A quién deseas transferir?
        </AppText>
        <TextField
          placeholder="Nombre de usuario del destinatario"
          autoCapitalize="none"
          value={recipient}
          onChangeText={setRecipient}
          editable={!isLoading}
        />
        <AppButton
          title="Siguiente"
          onPress={() => {
            const normalizedRecipient = recipient.trim()
            if (!normalizedRecipient) {
              return
            }
            setRecipient(normalizedRecipient)
            setStep('amount')
          }}
          disabled={!recipient.trim()}
          style={styles.actionButton}
        />
        <AppButton
          title="Cancelar"
          variant="secondary"
          onPress={() => {
            setIdempotencyKey(createIdempotencyKey())
            setConfirmedTransfer(null)
            navigation.navigate('Wallet')
          }}
        />
      </Screen>
    )
  }

  if (step === 'amount') {
    return (
      <Screen centered keyboardAware>
        <AppText variant="title" style={styles.stepTitle}>
          ¿Cuánto deseas transferir?
        </AppText>
        <TextField
          placeholder="Cantidad en COP"
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
          title="Siguiente"
          onPress={() => {
            const parsedAmount = parseAmount(amount)
            if (parsedAmount === null) {
              setAmountError('Ingresa una cantidad válida mayor a 0')
              return
            }
            setAmount(String(parsedAmount))
            setIdempotencyKey(createIdempotencyKey())
            setStep('confirm')
          }}
          disabled={!amount.trim()}
          style={styles.actionButton}
        />
        <AppButton
          title="Atrás"
          variant="secondary"
          onPress={() => setStep('recipient')}
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
            Ingresa una cantidad válida mayor a 0
          </AppText>
          <AppButton title="Volver al monto" onPress={() => setStep('amount')} />
        </Screen>
      )
    }

    return (
      <Screen centered contentStyle={styles.confirmContent}>
        <View>
          <AppText variant="title" style={styles.confirmTitle}>
            Confirma tu transferencia
          </AppText>
          <View style={styles.confirmCard}>
            <AppText style={styles.label}>Destinatario</AppText>
            <AppText variant="subtitle" style={styles.value}>
              {recipient}
            </AppText>
            <AppText style={styles.label}>Monto</AppText>
            <AppText variant="subtitle" style={styles.value}>
              COP {formatAmount(numAmount)}
            </AppText>
            <AppText style={styles.warning}>
              Esta acción no se puede deshacer
            </AppText>
          </View>
        </View>

        <View style={styles.actions}>
          <AppButton
            title="Transferir"
            onPress={async () => {
              try {
                const result = await submit({
                  destinationUsername: recipient.trim(),
                  amount: numAmount,
                  idempotencyKey,
                })
                setConfirmedTransfer(result)
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
            title="Atrás"
            variant="secondary"
            onPress={() => {
              setIdempotencyKey(createIdempotencyKey())
              setStep('amount')
            }}
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
  warning: {
    fontSize: theme.typography.small,
    color: theme.colors.danger,
    marginTop: theme.spacing.md,
    fontWeight: '600',
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
  successDetails: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xxl,
    width: '100%',
  },
  operationId: {
    fontSize: theme.typography.small,
    color: theme.colors.mutedText,
    fontFamily: 'monospace',
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
