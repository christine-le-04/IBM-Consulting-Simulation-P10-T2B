import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/store/authStore'
import { ensureFreshAccessToken } from '@/api/refreshSession'
import { useAnnouncementUpdates, usePublishAnnouncement } from './useAnnouncements'
import apiClient from '@/api/client'

type TestSocket = {
  activate: ReturnType<typeof vi.fn>
  deactivate: ReturnType<typeof vi.fn>
  subscribe: ReturnType<typeof vi.fn>
  connectHeaders: Record<string, string>
  beforeConnect?: () => Promise<void>
  onConnect?: () => void
}
const sockets = vi.hoisted(() => [] as TestSocket[])
vi.mock('@stomp/stompjs', () => ({ Client: vi.fn(function () {
  const socket: TestSocket = { activate: vi.fn(), deactivate: vi.fn(), subscribe: vi.fn(), connectHeaders: {} }
  sockets.push(socket)
  return socket
}) }))
vi.mock('@/api/refreshSession', () => ({ ensureFreshAccessToken: vi.fn() }))
vi.mock('@/api/client', () => ({ default: { post: vi.fn() } }))

describe('announcement publication retries', () => {
  beforeEach(() => { vi.clearAllMocks() })
  it('reuses the request key after a lost response and generates a new key for the next message', async () => {
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    const { result } = renderHook(() => usePublishAnnouncement(), { wrapper })
    const input = { title: 'Update', message: 'Hello' }
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Response lost')).mockResolvedValue({ data: { id: 'saved' } })
    await act(async () => { await expect(result.current.mutateAsync(input)).rejects.toThrow('Response lost') })
    await act(async () => { await result.current.mutateAsync(input) })
    const first = vi.mocked(apiClient.post).mock.calls[0][1] as { requestId: string }
    const retry = vi.mocked(apiClient.post).mock.calls[1][1] as { requestId: string }
    expect(first.requestId).toBeTruthy()
    expect(retry.requestId).toBe(first.requestId)
    await act(async () => { await result.current.mutateAsync(input) })
    expect((vi.mocked(apiClient.post).mock.calls[2][1] as { requestId: string }).requestId).not.toBe(first.requestId)
  })
  it('uses a new request key when a failed announcement is edited', async () => {
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    const { result } = renderHook(() => usePublishAnnouncement(), { wrapper })
    vi.mocked(apiClient.post).mockRejectedValue(new Error('Offline'))
    await act(async () => { await result.current.mutateAsync({ title: 'First', message: 'Hello' }).catch(() => {}) })
    await act(async () => { await result.current.mutateAsync({ title: 'Edited', message: 'Hello' }).catch(() => {}) })
    const calls = vi.mocked(apiClient.post).mock.calls
    expect((calls[0][1] as { requestId: string }).requestId).not.toBe((calls[1][1] as { requestId: string }).requestId)
  })
})

describe('announcement live updates', () => {
  beforeEach(() => {
    vi.clearAllMocks(); sockets.length = 0
    useAuthStore.getState().login({ userId: 'learner', accessToken: 'first-token', displayName: 'Learner', role: 'LEARNER', sessionId: 'first-session' })
  })
  afterEach(() => { useAuthStore.getState().logout() })

  it('authenticates reconnects with the current token and refreshes saved history on connection/events', async () => {
    const qc = new QueryClient()
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    const view = renderHook(() => useAnnouncementUpdates(), { wrapper })
    const socket = sockets[0]
    expect(socket.activate).toHaveBeenCalledOnce()
    await socket.beforeConnect?.()
    expect(ensureFreshAccessToken).toHaveBeenCalledOnce()
    expect(socket.connectHeaders.Authorization).toBe('Bearer first-token')
    socket.onConnect?.()
    expect(socket.subscribe).toHaveBeenCalledWith('/topic/announcements', expect.any(Function))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['announcements', 'learner'] })
    invalidate.mockClear()
    socket.subscribe.mock.calls[0][1]()
    expect(invalidate).toHaveBeenCalledOnce()
    act(() => useAuthStore.setState({ token: 'renewed-token' }))
    await socket.beforeConnect?.()
    expect(socket.connectHeaders.Authorization).toBe('Bearer renewed-token')
    view.unmount()
    expect(socket.deactivate).toHaveBeenCalledOnce()
  })

  it('disconnects on logout and ignores late socket callbacks from the old session', () => {
    const qc = new QueryClient()
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    const view = renderHook(() => useAnnouncementUpdates(), { wrapper })
    const socket = sockets[0]
    socket.onConnect?.()
    const callback = socket.subscribe.mock.calls[0][1]
    invalidate.mockClear()
    act(() => useAuthStore.getState().logout())
    expect(socket.deactivate).toHaveBeenCalledOnce()
    callback()
    expect(invalidate).not.toHaveBeenCalled()
    view.unmount()
  })
})
