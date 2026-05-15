export type AccessTokenProvider = () => Promise<string | null>

let accessTokenProvider: AccessTokenProvider = async () => null

export function setAccessTokenProvider(provider: AccessTokenProvider) {
  accessTokenProvider = provider
}

export function getAccessToken() {
  return accessTokenProvider()
}
