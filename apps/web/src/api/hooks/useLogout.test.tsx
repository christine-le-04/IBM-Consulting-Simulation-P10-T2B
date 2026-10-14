import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import apiClient from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { useLogout } from './useAuth'

vi.mock('@/api/client', () => ({ default: { post: vi.fn() } }))

function login(id: string) {
  useAuthStore.getState().login({ accessToken: id + '-token', userId: id, displayName: id, role: 'LEARNER' })
}

function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return renderHook(() => useLogout(), { wrapper })
}

beforeEach(() => { vi.resetAllMocks(); login('account-a') })
afterEach(() => { cleanup(); useAuthStore.getState().logout() })

describe('server-side logout', () => {
  it('waits for confirmed revocation before clearing the browser session', async () => {
    let finish!: (value: unknown) => void
    vi.mocked(apiClient.post).mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const { result } = setup()
    act(() => result.current.mutate())
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/v1/auth/logout', undefined,
      expect.objectContaining({ withCredentials: true, headers: { 'X-Session-Request': '1' } })))
    expect(useAuthStore.getState().token).toBe('account-a-token')
    await act(async () => { finish({ status: 204 }) })
    await waitFor(() => expect(useAuthStore.getState().token).toBeNull())
  })

  it('preserves the session on failure so the user can retry logout', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('network unavailable'))
    const { result } = setup()
    act(() => result.current.mutate())
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(useAuthStore.getState().token).toBe('account-a-token')
  })

  it('does not clear a new login when an old logout finishes late', async () => {
    let finish!: (value: unknown) => void
    vi.mocked(apiClient.post).mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    const { result } = setup()
    act(() => result.current.mutate())
    await waitFor(() => expect(apiClient.post).toHaveBeenCalled())
    act(() => login('account-b'))
    await act(async () => { finish({ status: 204 }) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(useAuthStore.getState().token).toBe('account-b-token')
  })
})
