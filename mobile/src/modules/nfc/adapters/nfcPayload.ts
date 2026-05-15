import { Ndef } from 'react-native-nfc-manager'
import type { NdefRecord, TagEvent } from 'react-native-nfc-manager'
import type { NfcRecipientPayload } from '../types'
import { NfcPayloadError } from '../types'

function isTextRecord(record: NdefRecord): boolean {
  return Ndef.isType(record, Ndef.TNF_WELL_KNOWN, Ndef.RTD_TEXT)
}

function parseRecipientPayload(value: unknown): NfcRecipientPayload {
  if (!value || typeof value !== 'object') {
    throw new NfcPayloadError('invalid_shape')
  }

  const payload = value as Partial<NfcRecipientPayload>
  if (payload.type !== 'flowpay_recipient') {
    throw new NfcPayloadError('invalid_shape')
  }

  if (typeof payload.username !== 'string' || !payload.username.trim()) {
    throw new NfcPayloadError('invalid_shape')
  }

  return {
    type: 'flowpay_recipient',
    username: payload.username.trim(),
  }
}

export function decodeRecipientPayloadFromText(text: string): NfcRecipientPayload {
  try {
    return parseRecipientPayload(JSON.parse(text))
  } catch (error) {
    if (error instanceof NfcPayloadError) {
      throw error
    }
    throw new NfcPayloadError('invalid_json')
  }
}

export function encodeRecipientPayload(payload: NfcRecipientPayload): NdefRecord {
  return Ndef.textRecord(JSON.stringify(parseRecipientPayload(payload)))
}

export function decodeRecipientPayloadFromRecord(record: NdefRecord): NfcRecipientPayload {
  if (!isTextRecord(record)) {
    throw new NfcPayloadError('missing_payload')
  }

  let decoded: string
  try {
    decoded = Ndef.text.decodePayload(Uint8Array.from(record.payload))
  } catch {
    throw new NfcPayloadError('invalid_shape')
  }

  return decodeRecipientPayloadFromText(decoded)
}

export function decodeRecipientPayloadFromTag(tag: TagEvent | null): NfcRecipientPayload {
  const record = tag?.ndefMessage?.find(isTextRecord)
  if (!record) {
    throw new NfcPayloadError('missing_payload')
  }

  return decodeRecipientPayloadFromRecord(record)
}
