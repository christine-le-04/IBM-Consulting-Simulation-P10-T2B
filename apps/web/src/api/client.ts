import axios, { CanceledError, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/store/authStore'
import { shouldInvalidateSession } from '@/api/authSession'
import { useSessionBoundary } from '@/api/sessionBoundary'
import { refreshSession } from '@/api/refreshSession'

declare module 'axios' {
  interface AxiosRequestConfig { sessionRefreshAttempted?: boolean }
}

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

const apiClient = axios.create({
  baseURL: apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
  // A stalled dependency must surface as a recoverable UI error, never a forever-loading workspace.
  timeout: 8_000,
})

const requestSessions = new WeakMap<InternalAxiosRequestConfig, number>()

function isPreviousSession(config: InternalAxiosRequestConfig | undefined) {
  if (!config) return false
  const revision = requestSessions.get(config)
  return revision !== undefined && revision !== useSessionBoundary.getState().revision
}

// Attach credentials and cancel requests when their session ends. Preserve any
// caller-provided cancellation signal (for example React Query's).
apiClient.interceptors.request.use((config) => {
  const session = useSessionBoundary.getState()
  requestSessions.set(config, session.revision)
  config.signal = config.signal
    ? AbortSignal.any([session.signal, config.signal as AbortSignal])
    : session.signal
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
}, undefined, { synchronous: true })

// Redirect to login on 401
apiClient.interceptors.response.use(
  (response) => {
    if (isPreviousSession(response.config)) {
      throw new CanceledError('Session changed', response.config)
    }
    return response
  },
  async (error) => {
    if (isPreviousSession(error.config)) {
      return Promise.reject(new CanceledError('Session changed', error.config))
    }
    if (error.response?.status === 401) {
      const authorization = error.config?.headers?.Authorization as string | undefined
      const currentToken = useAuthStore.getState().token

      // Only the request authenticated with the current token may invalidate the
      // current session. Anonymous login failures and late responses carrying an
      // older token must not erase a newer successful login.
      const config = error.config as InternalAxiosRequestConfig | undefined
      if (config && currentToken && authorization?.startsWith('Bearer ')
          && !config.sessionRefreshAttempted && config.url !== '/api/v1/auth/login'
          && config.url !== '/api/v1/auth/logout') {
        config.sessionRefreshAttempted = true
        // A newer access JWT may already have been issued by the refresh timer.
        if (shouldInvalidateSession(401, authorization, currentToken)) await refreshSession()
        if (isPreviousSession(config)) throw new CanceledError('Session changed', config)
        return apiClient.request(config)
      }
      if (shouldInvalidateSession(401, authorization, currentToken)) {
        useAuthStore.getState().logout(false)
      }
    }
    return Promise.reject(error)
  }
)

export default apiClient
