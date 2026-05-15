import type { NfcRecipientPayload } from './types'

export function getRecipientUsernameFromPayload(payload: NfcRecipientPayload): string {
  return payload.username
}
