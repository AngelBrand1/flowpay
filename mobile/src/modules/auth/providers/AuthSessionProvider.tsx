import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react'
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

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isRestoringSession, setIsRestoringSession] = useState(true)

  useEffect(() => {
    let isMounted = true

    getStoredAccessToken()
      .then((storedToken) => {
        if (isMounted) {
          setAccessToken(storedToken)
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsRestoringSession(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  const login = useCallback(async (newAccessToken: string, newUser: User) => {
    await saveAccessToken(newAccessToken)
    setAccessToken(newAccessToken)
    setUser(newUser)
  }, [])

  const logout = useCallback(async () => {
    await clearStoredAccessToken()
    setAccessToken(null)
    setUser(null)
  }, [])

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
