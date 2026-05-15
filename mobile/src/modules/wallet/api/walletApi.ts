import { ApiError } from '../../../shared/api/apiError'
import { httpClient } from '../../../shared/api/httpClient'
import type { Wallet, WalletResponse } from '../types'

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
