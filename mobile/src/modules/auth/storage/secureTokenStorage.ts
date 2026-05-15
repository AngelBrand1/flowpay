import * as SecureStore from 'expo-secure-store'

const ACCESS_TOKEN_KEY = 'fp_access_token'

export function saveAccessToken(token: string) {
  return SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token)
}

export function getStoredAccessToken() {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY)
}

export function clearStoredAccessToken() {
  return SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY)
}
