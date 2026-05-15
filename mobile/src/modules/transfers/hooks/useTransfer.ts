import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createTransfer, TransferApiError } from '../api/transferApi'
import type { Transfer } from '../types'

interface TransferInput {
  destinationUsername: string
  amount: number
  idempotencyKey: string
  origin?: 'manual_transfer' | 'nfc_transfer'
}

function mapTransferError(error: unknown): string {
  if (error instanceof TransferApiError) {
    switch (error.code) {
      case 'destination_user_not_found':
        return 'Usuario no encontrado'
      case 'destination_wallet_not_found':
        return 'La otra persona no tiene una cuenta disponible'
      case 'insufficient_balance':
        return 'Saldo insuficiente'
      case 'same_wallet_transfer':
        return 'No puedes enviarte plata a ti mismo'
      case 'invalid_amount':
        return 'Cantidad inválida'
      case 'idempotency_key_conflict':
        return 'Esta transferencia ya no se puede reintentar. Revísala e intenta de nuevo.'
      default:
        return 'Error al procesar la transferencia'
    }
  }

  return 'Error de conexión. Intenta de nuevo.'
}

export function useTransfer() {
  const queryClient = useQueryClient()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (input: TransferInput) =>
      createTransfer({
        destination_username: input.destinationUsername,
        amount: input.amount,
        origin: input.origin ?? 'manual_transfer',
        idempotencyKey: input.idempotencyKey,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] })
      queryClient.invalidateQueries({ queryKey: ['wallet', 'transactions'] })
      setErrorMessage(null)
    },
    onError: (error) => {
      setErrorMessage(mapTransferError(error))
    },
  })

  return {
    transfer: mutation.data,
    isLoading: mutation.isPending,
    error: errorMessage,
    submit: mutation.mutateAsync,
  }
}
