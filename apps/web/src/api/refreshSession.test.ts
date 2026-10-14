import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import axios, { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios'
import { refreshClient, refreshSession } from './refreshSession'
import apiClient from './client'
import { useAuthStore } from '@/store/authStore'
import { useSessionBoundary } from './sessionBoundary'

const originalRefreshAdapter = refreshClient.defaults.adapter
const originalApiAdapter = apiClient.defaults.adapter
const access = (token = 'fresh-access') => ({
  accessToken: token, userId: 'account-a', displayName: 'A', role: 'LEARNER', sessionId: 'session-a', expiresAt: Date.now() + 900000,
})
const response = (config: Parameters<AxiosAdapter>[0], data: unknown): AxiosResponse => ({ data, status: 200, statusText: 'OK', headers: {}, config })

beforeEach(() => useAuthStore.getState().renew(access('old-access')))
afterEach(() => {
  refreshClient.defaults.adapter = originalRefreshAdapter
  apiClient.defaults.adapter = originalApiAdapter
  useAuthStore.getState().logout(false)
  vi.restoreAllMocks()
})

describe('secure refresh', () => {
  it('deduplicates parallel requests and refreshes only through a credentialed custom-header request', async () => {
    let finish!: () => void
    const adapter = vi.fn<AxiosAdapter>((config) => new Promise((resolve) => {
      finish = () => resolve(response(config, access()))
      expect(config.withCredentials).toBe(true)
      expect(config.headers['X-Session-Request']).toBe('1')
      expect(config.headers.Authorization).toBeUndefined()
    }))
    refreshClient.defaults.adapter = adapter
    const first = refreshSession()
    const second = refreshSession()
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(1))
    finish()
    expect(await first).toEqual(await second)
    expect(useAuthStore.getState().token).toBe('fresh-access')
    expect(localStorage.getItem('auth-storage')).toBeNull()
  })

  it('preserves cache and pending requests on routine renewal', async () => {
    const previous = useSessionBoundary.getState()
    previous.queryClient.setQueryData(['portfolio'], 'private portfolio')
    refreshClient.defaults.adapter = async (config) => response(config, access())
    await refreshSession()
    expect(useSessionBoundary.getState()).toBe(previous)
    expect(previous.signal.aborted).toBe(false)
    expect(previous.queryClient.getQueryData(['portfolio'])).toBe('private portfolio')
  })

  it('cannot restore an old session after logout', async () => {
    let finish!: () => void
    const adapter = vi.fn<AxiosAdapter>((config) => new Promise((resolve) => { finish = () => resolve(response(config, access())) }))
    refreshClient.defaults.adapter = adapter
    const pending = refreshSession().catch((error: unknown) => error)
    await vi.waitFor(() => expect(adapter).toHaveBeenCalled())
    useAuthStore.getState().logout(false)
    finish()
    expect(axios.isCancel(await pending)).toBe(true)
    expect(useAuthStore.getState().token).toBeNull()
  })

  it('keeps the current session through a temporary backend outage', async () => {
    refreshClient.defaults.adapter = async (config) => {
      throw new AxiosError('Unavailable', undefined, config, undefined, { ...response(config, {}), status: 503 })
    }
    await expect(refreshSession()).rejects.toThrow('Unavailable')
    expect(useAuthStore.getState().token).toBe('old-access')
  })

  it('clears an invalid refresh session without retrying indefinitely', async () => {
    const adapter = vi.fn<AxiosAdapter>(async (config) => {
      throw new AxiosError('Unauthorized', undefined, config, undefined, { ...response(config, {}), status: 401 })
    })
    refreshClient.defaults.adapter = adapter
    await expect(refreshSession()).rejects.toThrow('Unauthorized')
    expect(useAuthStore.getState().token).toBeNull()
    expect(adapter).toHaveBeenCalledTimes(1)
  })

  it('retries an expired access request once with the fresh token', async () => {
    refreshClient.defaults.adapter = async (config) => response(config, access())
    const adapter = vi.fn<AxiosAdapter>(async (config) => {
      if (config.headers.Authorization === 'Bearer old-access') {
        throw new AxiosError('Unauthorized', undefined, config, undefined, { ...response(config, {}), status: 401 })
      }
      expect(config.headers.Authorization).toBe('Bearer fresh-access')
      return response(config, { private: 'account-a' })
    })
    apiClient.defaults.adapter = adapter
    expect((await apiClient.get('/api/v1/portfolio/summary')).data).toEqual({ private: 'account-a' })
    expect(adapter).toHaveBeenCalledTimes(2)
  })

  it('does not refresh anonymous login failures', async () => {
    useAuthStore.getState().logout(false)
    const refresh = vi.fn<AxiosAdapter>()
    refreshClient.defaults.adapter = refresh
    apiClient.defaults.adapter = async (config) => {
      throw new AxiosError('Unauthorized', undefined, config, undefined, { ...response(config, {}), status: 401 })
    }
    await expect(apiClient.post('/api/v1/auth/login')).rejects.toThrow('Unauthorized')
    expect(refresh).not.toHaveBeenCalled()
  })

  it('stops after a retried access token is also rejected', async () => {
    const refresh = vi.fn<AxiosAdapter>(async (config) => response(config, access()))
    refreshClient.defaults.adapter = refresh
    const adapter = vi.fn<AxiosAdapter>(async (config) => {
      throw new AxiosError('Unauthorized', undefined, config, undefined, { ...response(config, {}), status: 401 })
    })
    apiClient.defaults.adapter = adapter
    await expect(apiClient.get('/private')).rejects.toThrow('Unauthorized')
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(adapter).toHaveBeenCalledTimes(2)
    expect(useAuthStore.getState().token).toBeNull()
  })
})
