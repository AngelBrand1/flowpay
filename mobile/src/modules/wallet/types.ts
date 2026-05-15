export interface Wallet {
  id: string
  currency: string
  balance: number
}

export interface WalletResponse {
  wallet: Wallet
}
