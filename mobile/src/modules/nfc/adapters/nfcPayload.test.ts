import { Ndef } from 'react-native-nfc-manager'
import {
  decodeRecipientPayloadFromRecord,
  decodeRecipientPayloadFromTag,
  encodeRecipientPayload,
} from './nfcPayload'
import { NfcPayloadError } from '../types'

jest.mock('react-native-nfc-manager', () => {
  const textType = [0x54]
  const uriType = [0x55]

  const stringToBytes = (value: string) => Array.from(Buffer.from(value, 'utf8'))
  const bytesToString = (value: number[]) => Buffer.from(value).toString('utf8')

  return {
    Ndef: {
      TNF_WELL_KNOWN: 0x01,
      RTD_TEXT: 'T',
      RTD_URI: 'U',
      isType: (record: { tnf: number; type: number[] }, tnf: number, type: string) =>
        record.tnf === tnf &&
        type === 'T' &&
        Array.isArray(record.type) &&
        record.type.length === textType.length &&
        record.type.every((value, index) => value === textType[index]),
      text: {
        decodePayload: (payload: Uint8Array) => {
          const bytes = Array.from(payload)
          const languageLength = bytes[0]
          return bytesToString(bytes.slice(1 + languageLength))
        },
      },
      textRecord: (text: string) => ({
        tnf: 0x01,
        type: textType,
        payload: [2, ...stringToBytes('en'), ...stringToBytes(text)],
      }),
      uriRecord: (uri: string) => ({
        tnf: 0x01,
        type: uriType,
        payload: stringToBytes(uri),
      }),
    },
  }
})

describe('NFC recipient payload', () => {
  it('encodes and decodes a FlowPay recipient text record', () => {
    const record = encodeRecipientPayload({
      type: 'flowpay_recipient',
      username: 'alice',
    })

    expect(decodeRecipientPayloadFromRecord(record)).toEqual({
      type: 'flowpay_recipient',
      username: 'alice',
    })
  })

  it('decodes the first text record from a scanned NFC tag', () => {
    const record = encodeRecipientPayload({
      type: 'flowpay_recipient',
      username: 'bob',
    })

    expect(decodeRecipientPayloadFromTag({ ndefMessage: [record] })).toEqual({
      type: 'flowpay_recipient',
      username: 'bob',
    })
  })

  it('rejects records without a FlowPay text payload', () => {
    const record = Ndef.uriRecord('https://example.com')

    expect(() => decodeRecipientPayloadFromRecord(record)).toThrow(NfcPayloadError)
    expect(() => decodeRecipientPayloadFromRecord(record)).toThrow('missing_payload')
  })

  it('rejects malformed JSON text payloads', () => {
    const record = Ndef.textRecord('{bad json')

    expect(() => decodeRecipientPayloadFromRecord(record)).toThrow(NfcPayloadError)
    expect(() => decodeRecipientPayloadFromRecord(record)).toThrow('invalid_json')
  })

  it('rejects payloads without a transfer username', () => {
    const record = Ndef.textRecord(
      JSON.stringify({
        type: 'flowpay_recipient',
      })
    )

    expect(() => decodeRecipientPayloadFromRecord(record)).toThrow(NfcPayloadError)
    expect(() => decodeRecipientPayloadFromRecord(record)).toThrow('invalid_shape')
  })

  it('rejects display-only payloads because display names are not transfer addresses', () => {
    const record = Ndef.textRecord(
      JSON.stringify({
        type: 'flowpay_recipient',
        display_name: 'Alice Display',
      })
    )

    expect(() => decodeRecipientPayloadFromRecord(record)).toThrow(NfcPayloadError)
    expect(() => decodeRecipientPayloadFromRecord(record)).toThrow('invalid_shape')
  })

  it('rejects blank usernames', () => {
    const record = Ndef.textRecord(
      JSON.stringify({
        type: 'flowpay_recipient',
        username: '   ',
      })
    )

    expect(() => decodeRecipientPayloadFromRecord(record)).toThrow(NfcPayloadError)
    expect(() => decodeRecipientPayloadFromRecord(record)).toThrow('invalid_shape')
  })
})
