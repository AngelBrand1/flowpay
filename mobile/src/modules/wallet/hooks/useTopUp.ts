import { useMutation, useQueryClient } from '@tanstack/react-query'
import { topUp, WalletApiError } from '../api/walletApi'
import type { Transaction } from '../types'

function mapTopUpError(error: unknown): string {
  if (error instanceof WalletApiError) {
    switch (error.code) {
      case 'invalid_amount':
        return 'El monto ingresado no es válido'
      case 'wallet_not_found':
        return 'No encontramos tu cuenta'
      default:
        return 'No pudimos hacer la recarga'
    }
  }
  return 'Error de conexión. Intenta de nuevo.'
}

export function useTopUp() {
  const queryClient = useQueryClient()

  const mutation = useMutation<Transaction, unknown, number>({
    mutationFn: (amount: number) => topUp(amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet'] })
      queryClient.invalidateQueries({ queryKey: ['wallet', 'transactions'] })
    },
  })

  return {
    isLoading: mutation.isPending,
    error: mutation.error ? mapTopUpError(mutation.error) : null,
    submit: mutation.mutateAsync,
  }
}
