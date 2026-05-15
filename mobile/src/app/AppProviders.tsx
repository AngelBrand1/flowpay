import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { useState } from 'react'
import { AuthSessionProvider } from '../modules/auth/providers/AuthSessionProvider'
import { NfcPresenceProvider } from '../modules/nfc/providers/NfcPresenceProvider'
import { registerAuthTokenProvider } from '../modules/auth/storage/authTokenProvider'

registerAuthTokenProvider()

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  const clearCache = () => queryClient.clear()

  return (
    <QueryClientProvider client={queryClient}>
      <AuthSessionProvider onLogin={clearCache} onLogout={clearCache}>
        <NfcPresenceProvider>{children}</NfcPresenceProvider>
      </AuthSessionProvider>
    </QueryClientProvider>
  )
}
