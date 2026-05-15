import { setAccessTokenProvider } from '../../../shared/api/tokenProvider'
import { getStoredAccessToken } from './secureTokenStorage'

export function registerAuthTokenProvider() {
  setAccessTokenProvider(getStoredAccessToken)
}
