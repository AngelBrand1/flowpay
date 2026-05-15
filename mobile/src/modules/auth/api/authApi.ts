import { ApiError } from '../../../shared/api/apiError'
import { httpClient } from '../../../shared/api/httpClient'
import type { User } from '../types'

export class AuthApiError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message)
    this.name = 'AuthApiError'
  }
}

function extractApiError(error: unknown): never {
  if (error instanceof ApiError && error.code) {
    throw new AuthApiError(error.code, error.message)
  }
  throw error
}

export async function login(username: string, password: string): Promise<{ accessToken: string; user: User }> {
  try {
    const { data } = await httpClient.post('/auth/login', { username, password })
    return {
      accessToken: data.access_token,
      user: { id: data.user.id, username: data.user.username },
    }
  } catch (error) {
    extractApiError(error)
  }
}

export async function register(username: string, password: string): Promise<{ user: User }> {
  try {
    const { data } = await httpClient.post('/auth/register', { username, password })
    return { user: { id: data.user.id, username: data.user.username } }
  } catch (error) {
    extractApiError(error)
  }
}

export async function getMe(): Promise<User> {
  const { data } = await httpClient.get('/auth/me')
  return { id: data.user.id, username: data.user.username }
}
