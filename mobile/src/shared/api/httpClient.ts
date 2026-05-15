import axios from 'axios'
import { ApiError } from './apiError'
import { getAccessToken } from './tokenProvider'
import { handleUnauthenticated } from './unauthenticatedHandler'

export const httpClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000',
})

httpClient.interceptors.request.use(async (config) => {
  const token = await getAccessToken()

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      handleUnauthenticated()
    }

    if (axios.isAxiosError(error)) {
      const apiError = error.response?.data?.error
      return Promise.reject(
        new ApiError(
          error.response?.status,
          apiError?.code,
          apiError?.message ?? 'Request failed',
        ),
      )
    }

    return Promise.reject(error)
  },
)
