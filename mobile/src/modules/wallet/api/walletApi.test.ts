import { getTransactions, topUp, WalletApiError } from './walletApi'
import { httpClient } from '../../../shared/api/httpClient'

jest.mock('../../../shared/api/httpClient')

describe('walletApi', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getTransactions', () => {
    it('calls /wallet/transactions with limit=20 by default', async () => {
      const mockResponse = {
        transactions: [],
        next_cursor: null,
      }
      ;(httpClient.get as any).mockResolvedValue({ data: mockResponse })

      await getTransactions()

      expect(httpClient.get).toHaveBeenCalledWith('/wallet/transactions', {
        params: { limit: 20 },
      })
    })

    it('includes cursor in params when provided', async () => {
      const mockResponse = {
        transactions: [],
        next_cursor: null,
      }
      ;(httpClient.get as any).mockResolvedValue({ data: mockResponse })

      await getTransactions({ cursor: 'offset_10' })

      expect(httpClient.get).toHaveBeenCalledWith('/wallet/transactions', {
        params: { limit: 20, cursor: 'offset_10' },
      })
    })

    it('omits cursor from params when undefined', async () => {
      const mockResponse = {
        transactions: [],
        next_cursor: null,
      }
      ;(httpClient.get as any).mockResolvedValue({ data: mockResponse })

      await getTransactions({ cursor: undefined })

      expect(httpClient.get).toHaveBeenCalledWith('/wallet/transactions', {
        params: { limit: 20 },
      })
    })

    it('includes type in params when provided', async () => {
      const mockResponse = {
        transactions: [],
        next_cursor: null,
      }
      ;(httpClient.get as any).mockResolvedValue({ data: mockResponse })

      await getTransactions({ type: 'credit' })

      expect(httpClient.get).toHaveBeenCalledWith('/wallet/transactions', {
        params: { limit: 20, type: 'credit' },
      })
    })

    it('returns transactions page structure', async () => {
      const mockResponse = {
        transactions: [
          {
            id: 'txn_123',
            type: 'credit',
            amount: 50000,
            currency: 'COP',
            source: 'welcome_bonus',
            operation_id: null,
            counterparty: null,
            created_at: '2026-05-15T00:00:00Z',
          },
        ],
        next_cursor: 'offset_1',
      }
      ;(httpClient.get as any).mockResolvedValue({ data: mockResponse })

      const result = await getTransactions()

      expect(result.transactions).toHaveLength(1)
      expect(result.next_cursor).toBe('offset_1')
    })
  })

  describe('topUp', () => {
    it('calls POST /wallet/topup with amount', async () => {
      const mockTransaction = {
        id: 'txn_123',
        type: 'credit',
        amount: 100_000,
        currency: 'COP',
        source: 'topup',
        operation_id: null,
        counterparty: null,
        created_at: '2026-05-15T00:00:00Z',
      }
      ;(httpClient.post as any).mockResolvedValue({ data: { transaction: mockTransaction } })

      const result = await topUp(100_000)

      expect(httpClient.post).toHaveBeenCalledWith('/wallet/topup', { amount: 100_000 })
      expect(result.source).toBe('topup')
      expect(result.amount).toBe(100_000)
    })

    it('throws WalletApiError on API error', async () => {
      const { ApiError } = await import('../../../shared/api/apiError')
      ;(httpClient.post as any).mockRejectedValue(
        new ApiError(422, 'invalid_amount', 'Amount must be between 1 and 1,000,000 COP')
      )

      await expect(topUp(0)).rejects.toBeInstanceOf(WalletApiError)
    })
  })

  describe('WalletApiError', () => {
    it('creates error instance with code and message', () => {
      const error = new WalletApiError('test_code', 'Test message')

      expect(error.code).toBe('test_code')
      expect(error.message).toBe('Test message')
      expect(error.name).toBe('WalletApiError')
    })
  })
})
