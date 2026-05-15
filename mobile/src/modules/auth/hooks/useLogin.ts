import { useState } from 'react'
import { login as apiLogin, AuthApiError } from '../api/authApi'
import { useAuthSession } from './useAuthSession'

export function useLogin() {
  const { login } = useAuthSession()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(username: string, password: string) {
    setIsLoading(true)
    setError(null)
    try {
      const result = await apiLogin(username, password)
      await login(result.accessToken, result.user)
    } catch (err) {
      if (err instanceof AuthApiError && err.code === 'invalid_credentials') {
        setError('Usuario o contraseña incorrectos')
      } else {
        setError('Error de conexión. Intenta de nuevo.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return { submit, isLoading, error }
}
