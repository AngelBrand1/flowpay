import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { getMe } from '../api/authApi'
import { setUnauthenticatedHandler } from '../../../shared/api/unauthenticatedHandler'
import type { User } from '../types'
import {
  clearStoredAccessToken,
  getStoredAccessToken,
  saveAccessToken,
} from '../storage/secureTokenStorage'

export interface AuthSessionContextValue {
  user: User | null
  accessToken: string | null
  isRestoringSession: boolean
  login: (accessToken: string, user: User) => Promise<void>
  logout: () => Promise<void>
}

export const AuthSessionContext = createContext<AuthSessionContextValue | null>(null)

interface AuthSessionProviderProps {
  children: React.ReactNode
  onLogin?: () => void
  onLogout?: () => void
}

export function AuthSessionProvider({ children, onLogin, onLogout }: AuthSessionProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isRestoringSession, setIsRestoringSession] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function restoreSession() {
      const storedToken = await getStoredAccessToken()
      if (!storedToken) return

      try {
        const me = await getMe()
        if (isMounted) {
          setAccessToken(storedToken)
          setUser(me)
        }
      } catch {
        await clearStoredAccessToken()
      }
    }

    restoreSession().finally(() => {
      if (isMounted) setIsRestoringSession(false)
    })

    return () => {
      isMounted = false
    }
  }, [])

  const login = useCallback(async (newAccessToken: string, newUser: User) => {
    onLogin?.()
    await saveAccessToken(newAccessToken)
    setAccessToken(newAccessToken)
    setUser(newUser)
  }, [onLogin])

  const logout = useCallback(async () => {
    await clearStoredAccessToken()
    setAccessToken(null)
    setUser(null)
    onLogout?.()
  }, [onLogout])

  useEffect(() => {
    setUnauthenticatedHandler(logout)
    return () => setUnauthenticatedHandler(() => {})
  }, [logout])

  const value = useMemo<AuthSessionContextValue>(
    () => ({ user, accessToken, isRestoringSession, login, logout }),
    [user, accessToken, isRestoringSession, login, logout],
  )

  return (
    <AuthSessionContext.Provider value={value}>
      {children}
    </AuthSessionContext.Provider>
  )
}
