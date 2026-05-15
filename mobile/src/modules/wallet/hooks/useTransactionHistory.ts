import { useInfiniteQuery } from '@tanstack/react-query'
import { getTransactions, WalletApiError } from '../api/walletApi'
import type { Transaction } from '../types'

export type TransactionFilter = 'all' | 'credit' | 'debit'

export function mapTransactionError(error: unknown): string {
  if (error instanceof WalletApiError) {
    switch (error.code) {
      case 'wallet_not_found':
        return 'Billetera no encontrada'
      default:
        return 'Error al cargar el historial'
    }
  }
  return 'Error de conexión. Intenta de nuevo.'
}

export function useTransactionHistory(filter: TransactionFilter) {
  const transactionType = filter === 'all' ? undefined : filter
  const { data, isLoading, isFetchingNextPage, isRefetching, error, fetchNextPage, hasNextPage, refetch } =
    useInfiniteQuery({
      queryKey: ['wallet', 'transactions', filter],
      queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
        getTransactions({ cursor: pageParam, type: transactionType }),
      initialPageParam: undefined as unknown as string | undefined,
      getNextPageParam: (lastPage) => lastPage.next_cursor,
      staleTime: 0,
    })

  const allTransactions: Transaction[] = data?.pages.flatMap((p) => p.transactions) ?? []

  return {
    transactions: allTransactions,
    isLoading,
    isFetchingNextPage,
    isRefetching,
    error: error ? mapTransactionError(error) : null,
    fetchNextPage,
    hasNextPage: hasNextPage ?? false,
    refetch,
  }
}
