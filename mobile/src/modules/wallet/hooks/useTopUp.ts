import { useMutation, useQueryClient } from '@tanstack/react-query'
import { topUp, WalletApiError } from '../api/walletApi'
import type { Transaction } from '../types'

function mapTopUpError(error: unknown): string {
  if (error instanceof WalletApiError) {
    switch (error.code) {
      case 'invalid_amount':
        return 'The entered amount is not valid'
      case 'wallet_not_found':
        return 'We could not find your wallet'
      default:
        return 'Error topping up balance'
    }
  }
  return 'Connection error. Please try again.'
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
