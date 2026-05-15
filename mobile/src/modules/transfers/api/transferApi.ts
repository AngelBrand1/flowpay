import { ApiError } from '../../../shared/api/apiError'
import { httpClient } from '../../../shared/api/httpClient'
import type { Transfer, TransferResponse, TransferRequest } from '../types'

export class TransferApiError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message)
    this.name = 'TransferApiError'
  }
}

function extractApiError(error: unknown): never {
  if (error instanceof ApiError && error.code) {
    throw new TransferApiError(error.code, error.message)
  }
  throw error
}

export async function createTransfer(request: TransferRequest): Promise<Transfer> {
  try {
    const { data } = await httpClient.post<TransferResponse>(
      '/transfers',
      {
        destination_username: request.destination_username,
        amount: request.amount,
        origin: request.origin,
      },
      {
        headers: {
          'Idempotency-Key': request.idempotencyKey,
        },
      }
    )
    return data.transfer
  } catch (error) {
    extractApiError(error)
  }
}
