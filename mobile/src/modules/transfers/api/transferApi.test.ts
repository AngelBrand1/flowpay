import { createTransfer, TransferApiError } from './transferApi'
import { httpClient } from '../../../shared/api/httpClient'

jest.mock('../../../shared/api/httpClient')

describe('transferApi', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('sends caller-provided idempotency key in headers', async () => {
    const mockTransfer = {
      id: 'transfer-1',
      source_wallet_id: 'wallet-1',
      destination_wallet_id: 'wallet-2',
      amount: 1000,
      currency: 'COP',
      origin: 'manual_transfer',
      status: 'completed',
      created_at: '2026-05-15T00:00:00Z',
    }

    ;(httpClient.post as jest.Mock).mockResolvedValue({
      data: { transfer: mockTransfer },
    })

    const idempotencyKey = 'test-key-123'
    await createTransfer({
      destination_username: 'recipient',
      amount: 1000,
      origin: 'manual_transfer',
      idempotencyKey,
    })

    expect(httpClient.post).toHaveBeenCalledWith(
      '/transfers',
      expect.any(Object),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Idempotency-Key': idempotencyKey,
        }),
      })
    )
  })

  it('does not generate or replace the idempotency key', async () => {
    const mockTransfer = {
      id: 'transfer-1',
      source_wallet_id: 'wallet-1',
      destination_wallet_id: 'wallet-2',
      amount: 1000,
      currency: 'COP',
      origin: 'manual_transfer',
      status: 'completed',
      created_at: '2026-05-15T00:00:00Z',
    }

    ;(httpClient.post as jest.Mock).mockResolvedValue({
      data: { transfer: mockTransfer },
    })

    const idempotencyKey = 'my-key-456'
    const result = await createTransfer({
      destination_username: 'recipient',
      amount: 500,
      origin: 'manual_transfer',
      idempotencyKey,
    })

    const callArgs = (httpClient.post as jest.Mock).mock.calls[0]
    const headers = callArgs[2]?.headers as Record<string, string>
    expect(headers['Idempotency-Key']).toBe(idempotencyKey)
    expect(result).toEqual(mockTransfer)
  })

  it('sends correct request payload shape', async () => {
    const mockTransfer = {
      id: 'transfer-1',
      source_wallet_id: 'wallet-1',
      destination_wallet_id: 'wallet-2',
      amount: 2000,
      currency: 'COP',
      origin: 'manual_transfer',
      status: 'completed',
      created_at: '2026-05-15T00:00:00Z',
    }

    ;(httpClient.post as jest.Mock).mockResolvedValue({
      data: { transfer: mockTransfer },
    })

    await createTransfer({
      destination_username: 'john_doe',
      amount: 2000,
      origin: 'manual_transfer',
      idempotencyKey: 'key-789',
    })

    expect(httpClient.post).toHaveBeenCalledWith(
      '/transfers',
      {
        destination_username: 'john_doe',
        amount: 2000,
        origin: 'manual_transfer',
      },
      expect.any(Object)
    )
  })
})
