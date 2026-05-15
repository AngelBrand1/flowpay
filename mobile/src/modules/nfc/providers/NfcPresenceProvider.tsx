import React, { useEffect } from 'react'
import { useAuthSession } from '../../auth/hooks/useAuthSession'
import { initNfcManager, startHceRecipient, stopHceRecipient } from '../adapters/hceAdapter'

export function NfcPresenceProvider({ children }: { children: React.ReactNode }) {
  const { accessToken, user } = useAuthSession()

  useEffect(() => {
    initNfcManager().catch(() => {})
  }, [])

  useEffect(() => {
    if (!accessToken || !user?.username) {
      stopHceRecipient().catch(() => {})
      return
    }

    startHceRecipient({
      type: 'flowpay_recipient',
      username: user.username,
    }).catch(() => {
      // NFC presence is opportunistic; manual transfer remains the fallback.
    })

    return () => {
      stopHceRecipient().catch(() => {})
    }
  }, [accessToken, user?.username])

  return <>{children}</>
}
