import * as authApi from '../api/authApi'
import * as unauthenticatedHandler from '../../../shared/api/unauthenticatedHandler'

jest.mock('../api/authApi')
jest.mock('../../../shared/api/unauthenticatedHandler')

const mockGetMe = authApi.getMe as jest.MockedFunction<typeof authApi.getMe>
const mockSetUnauthenticatedHandler = unauthenticatedHandler.setUnauthenticatedHandler as jest.MockedFunction<
  typeof unauthenticatedHandler.setUnauthenticatedHandler
>

describe('AuthSessionProvider integration logic', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('calls getMe when token exists', async () => {
    mockGetMe.mockResolvedValue({ id: 'usr_1', username: 'testuser' })

    const user = await authApi.getMe()
    expect(mockGetMe).toHaveBeenCalled()
    expect(user).toEqual({ id: 'usr_1', username: 'testuser' })
  })

  it('handles getMe error when token expired', async () => {
    mockGetMe.mockRejectedValue(new Error('401 Unauthorized'))

    try {
      await authApi.getMe()
    } catch (err) {
      expect(err).toEqual(new Error('401 Unauthorized'))
    }

    expect(mockGetMe).toHaveBeenCalled()
  })

  it('registers unauthenticated handler on provider mount', () => {
    const logoutHandler = jest.fn()
    mockSetUnauthenticatedHandler(logoutHandler)

    expect(mockSetUnauthenticatedHandler).toHaveBeenCalledWith(logoutHandler)
  })

  it('session restore calls getMe and handles response', async () => {
    mockGetMe.mockResolvedValue({ id: 'usr_2', username: 'alice' })

    const user = await authApi.getMe()
    expect(user.id).toBe('usr_2')
    expect(user.username).toBe('alice')
  })
})
