import { NativeModules, Platform } from 'react-native'
import NfcManager, { Ndef, NfcTech } from 'react-native-nfc-manager'
import { decodeRecipientPayloadFromText } from './nfcPayload'
import type { NfcRecipientPayload } from '../types'

const FLOWPAY_AID = [0xf0, 0x46, 0x4c, 0x4f, 0x57, 0x50, 0x41, 0x59]
const SELECT_APDU = [0x00, 0xa4, 0x04, 0x00, FLOWPAY_AID.length, ...FLOWPAY_AID, 0x00]
const STATUS_OK = [0x90, 0x00]
const DEFAULT_SCAN_TIMEOUT_MS = 5000

type FlowPayHceNativeModule = {
  isSupported(): Promise<boolean>
  setPayload(payload: string): Promise<void>
  clearPayload(): Promise<void>
}

const FlowPayHce = NativeModules.FlowPayHce as FlowPayHceNativeModule | undefined

function assertAndroidHceModule(): FlowPayHceNativeModule {
  if (Platform.OS !== 'android' || !FlowPayHce) {
    throw new Error('flowpay_hce_unavailable')
  }

  return FlowPayHce
}

export async function isHceSupported(): Promise<boolean> {
  if (Platform.OS !== 'android' || !FlowPayHce) {
    return false
  }

  return FlowPayHce.isSupported()
}

export async function startHceRecipient(payload: NfcRecipientPayload): Promise<void> {
  const hce = assertAndroidHceModule()
  await hce.setPayload(JSON.stringify(payload))
}

export async function stopHceRecipient(): Promise<void> {
  if (Platform.OS !== 'android' || !FlowPayHce) {
    return
  }

  await FlowPayHce.clearPayload()
}

function hasOkStatus(response: number[]): boolean {
  return (
    response.length >= 2 &&
    response[response.length - 2] === STATUS_OK[0] &&
    response[response.length - 1] === STATUS_OK[1]
  )
}

function rejectAfterTimeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('flowpay_hce_scan_timeout')), ms)
  })
}

export async function initNfcManager(): Promise<void> {
  await NfcManager.start()
}

export async function isNfcAvailable(): Promise<boolean> {
  try {
    const isSupported = await NfcManager.isSupported()
    if (!isSupported) return false

    await initNfcManager()
    return NfcManager.isEnabled()
  } catch {
    return false
  }
}

export async function scanHceRecipientPayload(
  timeoutMs = DEFAULT_SCAN_TIMEOUT_MS,
): Promise<NfcRecipientPayload> {
  try {
    const nfcAvailable = await isNfcAvailable()
    if (!nfcAvailable) {
      throw new Error('flowpay_nfc_unavailable')
    }

    await Promise.race([NfcManager.requestTechnology(NfcTech.IsoDep), rejectAfterTimeout(timeoutMs)])
    const response = await NfcManager.isoDepHandler.transceive(SELECT_APDU)

    if (!hasOkStatus(response)) {
      throw new Error('flowpay_hce_not_ready')
    }

    const payloadBytes = response.slice(0, -2)
    return decodeRecipientPayloadFromText(Ndef.util.bytesToString(payloadBytes))
  } finally {
    await NfcManager.cancelTechnologyRequest({ throwOnError: false })
  }
}
