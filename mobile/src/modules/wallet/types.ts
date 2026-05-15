export interface Wallet {
  id: string
  currency: string
  balance: number
}

export interface WalletResponse {
  wallet: Wallet
}

export interface TransactionCounterparty {
  wallet_id: string
  username: string
}

export interface Transaction {
  id: string
  type: 'credit' | 'debit'
  amount: number
  currency: string
  source: 'welcome_bonus' | 'manual_transfer'
  operation_id: string | null
  counterparty: TransactionCounterparty | null
  created_at: string
}

export interface TransactionsPage {
  transactions: Transaction[]
  next_cursor: string | null
}
