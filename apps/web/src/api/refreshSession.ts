import axios, { CanceledError } from 'axios'
import { useAuthStore } from '@/store/authStore'
import { useSessionBoundary } from '@/api/sessionBoundary'
import type { TokenResponse } from '@/api/types'

export const sessionHeaders = { 'X-Session-Request': '1' }

// Separate transport prevents expired-access-token retry loops on refresh.
export const refreshClient = axios.create({
  baseURL: (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, ''),
  withCredentials: true,
  headers: sessionHeaders,
  timeout: 8_000,
})

export async function withSessionLock<T>(work: () => Promise<T>): Promise<T> {
  // Cookies are shared by tabs; serialize rotation, login, and logout where the
  // browser supports Web Locks. The server tolerates one concurrent refresh.
  return navigator.locks ? await navigator.locks.request('consulting-sim-auth', work) : await work()
}

let inFlight: { promise: Promise<TokenResponse>; revision: number } | null = null

export function refreshSession(): Promise<TokenResponse> {
  const revision = useSessionBoundary.getState().revision
  if (inFlight) {
    return inFlight.revision === revision ? inFlight.promise : inFlight.promise.catch(() => {}).then(refreshSession)
  }
  const promise = withSessionLock(async () => {
    if (revision !== useSessionBoundary.getState().revision) throw new CanceledError('Session changed')
    try {
      const response = await refreshClient.post<TokenResponse>('/api/v1/auth/refresh')
      if (revision !== useSessionBoundary.getState().revision) throw new CanceledError('Session changed')
      useAuthStore.getState().renew(response.data)
      return response.data
    } catch (error) {
      if (revision === useSessionBoundary.getState().revision && axios.isAxiosError(error)
          && (error.response?.status === 401 || error.response?.status === 403)) {
        useAuthStore.getState().logout(false)
      }
      throw error
    }
  }).finally(() => { inFlight = null })
  inFlight = { promise, revision }
  return promise
}

export async function ensureFreshAccessToken() {
  const session = useAuthStore.getState()
  if (!session.token || (session.expiresAt > 0 && session.expiresAt - Date.now() <= 60_000)) {
    await refreshSession()
  }
}
