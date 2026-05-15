export interface Transfer {
  id: string
  source_wallet_id: string
  destination_wallet_id: string
  amount: number
  currency: string
  origin: string
  status: string
  created_at: string
}

export interface TransferResponse {
  transfer: Transfer
}

export interface TransferRequest {
  destination_username: string
  amount: number
  origin: string
  idempotencyKey: string
}
