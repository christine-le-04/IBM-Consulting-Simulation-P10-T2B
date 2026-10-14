import axios, { CanceledError, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/store/authStore'
import { shouldInvalidateSession } from '@/api/authSession'
import { useSessionBoundary } from '@/api/sessionBoundary'

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
  (error) => {
    if (isPreviousSession(error.config)) {
      return Promise.reject(new CanceledError('Session changed', error.config))
    }
    if (error.response?.status === 401) {
      const authorization = error.config?.headers?.Authorization as string | undefined
      const currentToken = useAuthStore.getState().token

      // Only the request authenticated with the current token may invalidate the
      // current session. Anonymous login failures and late responses carrying an
      // older token must not erase a newer successful login.
      if (shouldInvalidateSession(error.response.status, authorization, currentToken)) {
        console.warn('Session invalidated after API rejected the current token', {
          method: error.config?.method,
          url: error.config?.url,
        })
        useAuthStore.getState().logout()
        if (window.location.pathname !== '/login') {
          window.location.assign('/login')
        }
      }
    }
    return Promise.reject(error)
  }
)

export default apiClient
