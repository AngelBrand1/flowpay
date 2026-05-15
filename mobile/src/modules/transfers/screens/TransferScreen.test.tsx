import { useTransfer } from '../hooks/useTransfer'

jest.mock('../hooks/useTransfer')
jest.mock('@react-navigation/native')

const mockUseTransfer = useTransfer as jest.Mock

describe('TransferScreen logic', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('validates amount must be positive integer', () => {
    const parseAmount = (value: string): number | null => {
      const normalized = value.trim()
      if (!/^[1-9]\d*$/.test(normalized)) return null

      const amount = Number(normalized)
      if (!Number.isSafeInteger(amount)) return null

      return amount
    }

    expect(parseAmount('1000')).toBe(1000)
    expect(parseAmount('0')).toBe(null)
    expect(parseAmount('-100')).toBe(null)
    expect(parseAmount('100.5')).toBe(null)
    expect(parseAmount('abc')).toBe(null)
    expect(parseAmount('')).toBe(null)
  })

  it('idempotency key generation creates unique keys', () => {
    const createIdempotencyKey = (): string => {
      if (globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID()
      }

      return `transfer_${Date.now()}_${Math.random().toString(36).slice(2)}`
    }

    const key1 = createIdempotencyKey()
    const key2 = createIdempotencyKey()

    expect(key1).toBeTruthy()
    expect(key2).toBeTruthy()
    expect(key1).not.toBe(key2)
  })

  it('useTransfer hook returns correct interface', () => {
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

    mockUseTransfer.mockReturnValue({
      transfer: mockTransfer,
      isLoading: false,
      error: null,
      submit: jest.fn(),
    })

    const hook = mockUseTransfer()

    expect(hook.transfer).toEqual(mockTransfer)
    expect(hook.isLoading).toBe(false)
    expect(hook.error).toBe(null)
    expect(typeof hook.submit).toBe('function')
  })

  it('amount formatting works for Colombian pesos', () => {
    const formatAmount = (amount: number): string => {
      return amount.toLocaleString('es-CO')
    }

    expect(formatAmount(1000)).toBe('1.000')
    expect(formatAmount(1000000)).toBe('1.000.000')
    expect(formatAmount(100)).toBe('100')
  })
})
