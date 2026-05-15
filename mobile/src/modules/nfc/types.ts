export type NfcRecipientPayloadType = 'flowpay_recipient'

export interface NfcRecipientPayload {
  type: NfcRecipientPayloadType
  username: string
}

export class NfcPayloadError extends Error {
  constructor(public readonly code: 'missing_payload' | 'invalid_json' | 'invalid_shape') {
    super(code)
    this.name = 'NfcPayloadError'
  }
}
