import { useCallback, useState } from 'react'
import { isNfcAvailable, scanHceRecipientPayload } from '../adapters/hceAdapter'
import type { NfcRecipientPayload } from '../types'

export type NfcRecipientScanStatus = 'idle' | 'scanning' | 'found' | 'unavailable'

const PASSIVE_SCAN_ATTEMPT_MS = 2500

export function useNfcRecipientScanner() {
  const [status, setStatus] = useState<NfcRecipientScanStatus>('idle')

  const scanOnce = useCallback(async (): Promise<NfcRecipientPayload | null> => {
    const nfcAvailable = await isNfcAvailable()
    if (!nfcAvailable) {
      setStatus('unavailable')
      return null
    }

    setStatus('scanning')

    try {
      const payload = await scanHceRecipientPayload()
      setStatus('found')
      return payload
    } catch {
      setStatus('unavailable')
      return null
    }
  }, [])

  const scanContinuously = useCallback(
    async (
      onPayload: (payload: NfcRecipientPayload) => void,
      shouldContinue: () => boolean,
    ): Promise<void> => {
      const nfcAvailable = await isNfcAvailable()
      if (!shouldContinue()) {
        setStatus('idle')
        return
      }

      if (!nfcAvailable) {
        setStatus('unavailable')
        return
      }

      setStatus('scanning')

      while (shouldContinue()) {
        try {
          const payload = await scanHceRecipientPayload(PASSIVE_SCAN_ATTEMPT_MS)
          if (!shouldContinue()) {
            setStatus('idle')
            return
          }
          setStatus('found')
          onPayload(payload)
          return
        } catch (error) {
          if (!shouldContinue()) {
            setStatus('idle')
            return
          }
          if (error instanceof Error && error.message === 'flowpay_hce_scan_timeout') {
            continue
          }
          setStatus('unavailable')
          return
        }
      }

      setStatus('idle')
    },
    [],
  )

  const reset = useCallback(() => {
    setStatus('idle')
  }, [])

  return { status, scanOnce, scanContinuously, reset }
}
