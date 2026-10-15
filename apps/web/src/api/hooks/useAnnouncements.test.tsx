import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/store/authStore'
import { ensureFreshAccessToken } from '@/api/refreshSession'
import { useAnnouncementUpdates } from './useAnnouncements'

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
