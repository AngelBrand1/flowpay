import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { ProtectedStackParamList } from '../../../app/navigation/types'
import { AppButton, AppText, TextField, Screen, theme } from '../../../shared/ui'
import { useNfcRecipientScanner } from '../../nfc/hooks/useNfcRecipientScanner'
import { getRecipientUsernameFromPayload } from '../../nfc/nfcRecipient'
import { useTransfer } from '../hooks/useTransfer'
import type { Transfer } from '../types'

type Nav = NativeStackNavigationProp<ProtectedStackParamList, 'Transfer'>

type TransferStep = 'recipient' | 'amount' | 'confirm' | 'success' | 'error'
type TransferOrigin = 'manual_transfer' | 'nfc_transfer'

function createIdempotencyKey(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
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
  const [origin, setOrigin] = useState<TransferOrigin>('manual_transfer')
  const {
    status: nfcScanStatus,
    scanContinuously: scanNfcRecipients,
    reset: resetNfcScan,
  } = useNfcRecipientScanner()
  const recipientRef = useRef(recipient)
  const stepRef = useRef(step)

  useEffect(() => {
    recipientRef.current = recipient
  }, [recipient])

  useEffect(() => {
    stepRef.current = step
  }, [step])

  useEffect(() => {
    if (step !== 'recipient' || recipient.trim()) {
      resetNfcScan()
      return
    }

    let active = true

    scanNfcRecipients(
      (payload) => {
        const destination = getRecipientUsernameFromPayload(payload)
        if (!destination || !active || recipientRef.current.trim()) return
        setRecipient(destination)
        setOrigin('nfc_transfer')
        setStep('amount')
      },
      () => active && stepRef.current === 'recipient' && !recipientRef.current.trim(),
    )

    return () => {
      active = false
    }
  }, [recipient, resetNfcScan, scanNfcRecipients, step])

  function resetTransferDraft() {
    setIdempotencyKey(createIdempotencyKey())
    setConfirmedTransfer(null)
    setOrigin('manual_transfer')
    resetNfcScan()
  }

  if (step === 'success' && confirmedTransfer) {
    return (
      <Screen centered>
        <View style={styles.successBadge}>
          <AppText style={styles.successBadgeText}>✓</AppText>
        </View>
        <AppText variant="title" style={styles.successTitle}>
          Plata enviada
        </AppText>
        <View style={styles.successDetails}>
          <AppText style={styles.label}>Para</AppText>
          <AppText variant="subtitle" style={styles.value}>
            {recipient}
          </AppText>
          <AppText style={styles.label}>Monto</AppText>
          <AppText variant="subtitle" style={styles.value}>
            COP {formatAmount(confirmedTransfer.amount)}
          </AppText>
          <AppText variant="muted" style={styles.successHint}>
            Puedes revisar esta transferencia en tus movimientos.
          </AppText>
        </View>
        <AppButton
          title="Volver al inicio"
          onPress={() => navigation.navigate('Wallet')}
          style={styles.actionButton}
        />
      </Screen>
    )
  }

  if (step === 'error') {
    return (
      <Screen centered>
        <View style={styles.errorBadge}>
          <AppText style={styles.errorBadgeText}>!</AppText>
        </View>
        <AppText variant="title" style={styles.errorTitle}>
          No se pudo enviar
        </AppText>
        <AppText variant="body" style={styles.errorMessage}>
          {error ?? 'Revisa los datos e intenta de nuevo.'}
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
                origin,
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
            resetTransferDraft()
          }}
        />
        <AppButton
          title="Volver al inicio"
          variant="ghost"
          onPress={() => {
            resetTransferDraft()
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
          Enviando tu plata...
        </AppText>
      </Screen>
    )
  }

  if (step === 'recipient') {
    return (
      <Screen centered keyboardAware>
        <AppText variant="muted" style={styles.stepEyebrow}>
          Paso 1 de 3
        </AppText>
        <AppText variant="title" style={styles.stepTitle}>
          ¿A quién le vas a enviar?
        </AppText>
        <TextField
          placeholder="Usuario de la persona"
          autoCapitalize="none"
          value={recipient}
          onChangeText={(text) => {
            setRecipient(text)
            setOrigin('manual_transfer')
          }}
          editable={!isLoading}
        />
        <View style={styles.nfcStatusCard}>
          <AppText variant="muted" style={styles.nfcStatusText}>
            {nfcScanStatus === 'found'
              ? 'Persona detectada por NFC'
              : nfcScanStatus === 'unavailable'
                ? 'NFC no disponible'
                : 'O acerca el celular para detectar por NFC'}
          </AppText>
        </View>
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
          variant="ghost"
          onPress={() => {
            resetTransferDraft()
            navigation.navigate('Wallet')
          }}
        />
      </Screen>
    )
  }

  if (step === 'amount') {
    return (
      <Screen centered keyboardAware>
        <AppText variant="muted" style={styles.stepEyebrow}>
          Paso 2 de 3
        </AppText>
        <AppText variant="title" style={styles.stepTitle}>
          ¿Cuánto vas a enviar?
        </AppText>
        {origin === 'nfc_transfer' && (
          <AppText variant="muted" style={styles.originText}>
            Persona detectada por NFC
          </AppText>
        )}
        <TextField
          placeholder="Monto en pesos"
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
          variant="ghost"
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
          <AppText variant="muted" style={styles.stepEyebrow}>
            Paso 3 de 3
          </AppText>
          <AppText variant="title" style={styles.confirmTitle}>
            Confirma el envío
          </AppText>
          <View style={styles.confirmCard}>
            <AppText style={styles.label}>Para</AppText>
            <AppText variant="subtitle" style={styles.value}>
              {recipient}
            </AppText>
            <AppText style={styles.label}>Monto</AppText>
            <AppText variant="subtitle" style={styles.value}>
              COP {formatAmount(numAmount)}
            </AppText>
            <AppText style={styles.warning}>
              Revisa bien. Después de enviar no se puede deshacer.
            </AppText>
          </View>
        </View>

        <View style={styles.actions}>
          <AppButton
            title="Enviar ahora"
            onPress={async () => {
              try {
                const result = await submit({
                  destinationUsername: recipient.trim(),
                  amount: numAmount,
                  idempotencyKey,
                  origin,
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
            variant="ghost"
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
  stepEyebrow: {
    color: theme.colors.primary,
    fontSize: theme.typography.small,
    fontWeight: '800',
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  stepTitle: {
    marginBottom: theme.spacing.xl,
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
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xxl,
    ...theme.shadow.card,
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
    color: theme.colors.warning,
    backgroundColor: theme.colors.warningTint,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
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
    marginBottom: theme.spacing.xl,
    textAlign: 'center',
    color: theme.colors.success,
  },
  successBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.successTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  successBadgeText: {
    color: theme.colors.success,
    fontSize: 34,
    fontWeight: '800',
  },
  successDetails: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xxl,
    width: '100%',
    ...theme.shadow.card,
  },
  successHint: {
    marginTop: theme.spacing.sm,
  },
  errorBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.dangerTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  errorBadgeText: {
    color: theme.colors.danger,
    fontSize: 34,
    fontWeight: '800',
  },
  errorTitle: {
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
    color: theme.colors.danger,
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
  nfcStatusCard: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primaryTint,
    paddingHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  nfcStatusText: {
    textAlign: 'center',
    fontSize: theme.typography.small,
  },
  originText: {
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
})
