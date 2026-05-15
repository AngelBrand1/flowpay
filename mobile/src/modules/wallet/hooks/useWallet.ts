import { useQuery } from '@tanstack/react-query'
import { getWallet, WalletApiError } from '../api/walletApi'
import type { Wallet } from '../types'

export function useWallet() {
  const { data: wallet, isLoading, error, refetch } = useQuery<Wallet, WalletApiError>({
    queryKey: ['wallet'],
    queryFn: getWallet,
    staleTime: 0,
  })

  const errorMessage = error
    ? error.code === 'wallet_not_found'
      ? 'Wallet not found'
      : 'Error loading wallet. Please try again.'
    : null

  return { wallet, isLoading, error: errorMessage, refetch }
}
