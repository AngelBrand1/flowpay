import { mapTransactionError, type TransactionFilter } from './useTransactionHistory'
import { WalletApiError } from '../api/walletApi'

describe('useTransactionHistory', () => {
  describe('mapTransactionError', () => {
    it('maps wallet_not_found error code to Spanish message', () => {
      const error = new WalletApiError('wallet_not_found', 'Wallet not found')
      const result = mapTransactionError(error)

      expect(result).toBe('Billetera no encontrada')
    })

    it('maps unknown error codes to generic message', () => {
      const error = new WalletApiError('unknown_code', 'Some error')
      const result = mapTransactionError(error)

      expect(result).toBe('Error al cargar el historial')
    })

    it('maps non-WalletApiError to connection error', () => {
      const error = new Error('Network error')
      const result = mapTransactionError(error)

      expect(result).toBe('Error de conexión. Intenta de nuevo.')
    })

    it('maps unknown type to connection error', () => {
      const result = mapTransactionError(null)

      expect(result).toBe('Error de conexión. Intenta de nuevo.')
    })
  })

  describe('TransactionFilter type', () => {
    it('allows all, credit, and debit as valid filter values', () => {
      const filters: TransactionFilter[] = ['all', 'credit', 'debit']

      expect(filters).toEqual(['all', 'credit', 'debit'])
    })
  })
})
