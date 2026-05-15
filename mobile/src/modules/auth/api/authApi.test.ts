import { login, register, getMe, AuthApiError } from './authApi'
import * as httpClientModule from '../../../shared/api/httpClient'
import { ApiError } from '../../../shared/api/apiError'

jest.mock('../../../shared/api/httpClient')

const mockHttpClient = httpClientModule.httpClient as jest.Mocked<typeof httpClientModule.httpClient>

describe('authApi', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('login', () => {
    it('maps access_token to accessToken and returns user', async () => {
      mockHttpClient.post.mockResolvedValue({
        data: {
          access_token: 'token123',
          user: { id: 'usr_1', username: 'testuser' },
        },
      })

      const result = await login('testuser', 'password')

      expect(result).toEqual({
        accessToken: 'token123',
        user: { id: 'usr_1', username: 'testuser' },
      })
      expect(mockHttpClient.post).toHaveBeenCalledWith('/auth/login', {
        username: 'testuser',
        password: 'password',
      })
    })

    it('throws AuthApiError with backend code on ApiError', async () => {
      const apiError = new ApiError(401, 'invalid_credentials', 'Bad credentials')
      mockHttpClient.post.mockRejectedValue(apiError)

      await expect(login('user', 'wrong')).rejects.toThrow(AuthApiError)
      try {
        await login('user', 'wrong')
      } catch (err) {
        expect(err).toBeInstanceOf(AuthApiError)
        if (err instanceof AuthApiError) {
          expect(err.code).toBe('invalid_credentials')
        }
      }
    })
  })

  describe('register', () => {
    it('returns only user, ignores wallet payload', async () => {
      mockHttpClient.post.mockResolvedValue({
        data: {
          user: { id: 'usr_2', username: 'newuser' },
          wallet: { id: 'wal_1', balance: 50000 },
        },
      })

      const result = await register('newuser', 'password')

      expect(result).toEqual({ user: { id: 'usr_2', username: 'newuser' } })
      expect(mockHttpClient.post).toHaveBeenCalledWith('/auth/register', {
        username: 'newuser',
        password: 'password',
      })
    })

    it('throws AuthApiError on username_already_exists', async () => {
      const apiError = new ApiError(409, 'username_already_exists', 'Username taken')
      mockHttpClient.post.mockRejectedValue(apiError)

      await expect(register('taken', 'pass')).rejects.toThrow(AuthApiError)
      try {
        await register('taken', 'pass')
      } catch (err) {
        if (err instanceof AuthApiError) {
          expect(err.code).toBe('username_already_exists')
        }
      }
    })
  })

  describe('getMe', () => {
    it('returns user from /auth/me', async () => {
      mockHttpClient.get.mockResolvedValue({
        data: { user: { id: 'usr_1', username: 'testuser' } },
      })

      const result = await getMe()

      expect(result).toEqual({ id: 'usr_1', username: 'testuser' })
      expect(mockHttpClient.get).toHaveBeenCalledWith('/auth/me')
    })
  })
})
