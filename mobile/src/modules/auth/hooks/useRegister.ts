import { useState } from 'react'
import { register as apiRegister, login as apiLogin, AuthApiError } from '../api/authApi'
import { useAuthSession } from './useAuthSession'

export function useRegister() {
  const { login } = useAuthSession()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(username: string, password: string) {
    setIsLoading(true)
    setError(null)
    try {
      await apiRegister(username, password)
      const result = await apiLogin(username, password)
      await login(result.accessToken, result.user)
    } catch (err) {
      if (err instanceof AuthApiError) {
        if (err.code === 'username_already_exists') {
          setError('Ese nombre de usuario ya está en uso')
        } else {
          setError('Error al registrarse. Intenta de nuevo.')
        }
      } else {
        setError('Error de conexión. Intenta de nuevo.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return { submit, isLoading, error }
}
