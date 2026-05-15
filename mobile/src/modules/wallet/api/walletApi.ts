import { ApiError } from '../../../shared/api/apiError'
import { httpClient } from '../../../shared/api/httpClient'
import type { Wallet, WalletResponse, TransactionsPage } from '../types'

export class WalletApiError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message)
    this.name = 'WalletApiError'
  }
}

function extractApiError(error: unknown): never {
  if (error instanceof ApiError && error.code) {
    throw new WalletApiError(error.code, error.message)
  }
  throw error
}

export async function getWallet(): Promise<Wallet> {
  try {
    const { data } = await httpClient.get<WalletResponse>('/wallet')
    return data.wallet
  } catch (error) {
    extractApiError(error)
  }
}

interface GetTransactionsParams {
  cursor?: string
  limit?: number
  type?: 'credit' | 'debit'
}

export async function getTransactions(params: GetTransactionsParams = {}): Promise<TransactionsPage> {
  try {
    const { data } = await httpClient.get<TransactionsPage>('/wallet/transactions', {
      params: {
        limit: params.limit ?? 20,
        ...(params.cursor !== undefined && { cursor: params.cursor }),
        ...(params.type !== undefined && { type: params.type }),
      },
    })
    return data
  } catch (error) {
    extractApiError(error)
  }
}
