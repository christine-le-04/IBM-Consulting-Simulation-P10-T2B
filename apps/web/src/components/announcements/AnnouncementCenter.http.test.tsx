import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import apiClient from '@/api/client'
import { useAnnouncements, useAnnouncementUpdates, useMarkAllAnnouncementsRead, type Announcement, type AnnouncementFeed } from '@/api/hooks/useAnnouncements'
import { useAuthStore } from '@/store/authStore'
import AnnouncementCenter from './AnnouncementCenter'

type TestSocket = {
  activate: ReturnType<typeof vi.fn>
  deactivate: ReturnType<typeof vi.fn>
  subscribe: ReturnType<typeof vi.fn>
  onConnect?: () => void
}
const sockets = vi.hoisted(() => [] as TestSocket[])
vi.mock('@stomp/stompjs', () => ({ Client: vi.fn(function () {
  const socket: TestSocket = { activate: vi.fn(), deactivate: vi.fn(), subscribe: vi.fn() }
  sockets.push(socket)
  return socket
}) }))

const originalAdapter = apiClient.defaults.adapter
let clients: QueryClient[]
let notices: Announcement[]
let reads: Map<string, Set<string>>
let requests: InternalAxiosRequestConfig[]
let failFeed: boolean
let failRead: boolean
let delayFeedFor: string | undefined
let releaseFeed: (() => void) | undefined

function login(id = 'first') {
  useAuthStore.getState().login({ userId: id, accessToken: id, displayName: id, role: 'LEARNER', sessionId: `${id}-session` })
}
function notice(id: string): Announcement {
  return { id, kind: 'ADMIN_MESSAGE', title: `Update ${id}`, message: 'Saved update', scenarioId: null,
    scenarioTitle: null, createdAt: '2026-10-16T00:00:00Z', read: false }
}
function feed(userId: string, config: InternalAxiosRequestConfig): AnnouncementFeed {
  const items = notices.map((item) => ({ ...item, read: reads.get(userId)?.has(item.id) ?? false }))
  const filtered = config.params?.unreadOnly ? items.filter((item) => !item.read) : items
  return { items: filtered, totalElements: filtered.length, unreadCount: items.filter((item) => !item.read).length,
    page: 0, size: 20, readThrough: '2026-10-16T01:00:00Z' }
}

// Keep the real Axios client, interceptors, React Query hooks and component. Replace only transport.
const adapter: AxiosAdapter = async (config) => {
  requests.push(config)
  const userId = String(config.headers.Authorization).replace('Bearer ', '')
  const response = (data: unknown) => ({ config, data, status: 200, statusText: 'OK', headers: {} })
  if (config.method === 'get' && config.url === '/api/v1/announcements') {
    if (failFeed) throw new AxiosError('Unavailable', 'ERR_BAD_RESPONSE', config, undefined, { ...response({}), status: 503 })
    const snapshot = feed(userId, config)
    if (delayFeedFor === userId) {
      delayFeedFor = undefined
      await new Promise<void>((resolve) => { releaseFeed = resolve })
    }
    return response(snapshot)
  }
  if (config.method === 'post' && ['/api/v1/announcements/read', '/api/v1/announcements/read-all'].includes(config.url ?? '')) {
    if (failRead) throw new AxiosError('Unavailable', 'ERR_BAD_RESPONSE', config, undefined, { ...response({}), status: 503 })
    const body = JSON.parse(config.data as string) as { ids?: string[]; through?: string }
    const ids = body.ids ?? notices.map((item) => item.id)
    const saved = reads.get(userId) ?? new Set<string>()
    ids.forEach((id) => saved.add(id))
    reads.set(userId, saved)
    return { ...response(null), status: 204 }
  }
  throw new Error(`Unexpected request: ${config.method} ${config.url}`)
}

function context() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } })
  clients.push(client)
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>
    <MemoryRouter>{children}</MemoryRouter>
  </QueryClientProvider>
  return { wrapper }
}
function getRequests() { return requests.filter((request) => request.method === 'get') }
function showCenter() { render(<AnnouncementCenter />, context()) }

describe('announcement HTTP handling and missed-update recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks(); sockets.length = 0
    clients = []; notices = [notice('one')]; reads = new Map(); requests = []
    failFeed = false; failRead = false; delayFeedFor = undefined; releaseFeed = undefined
    onlineManager.setOnline(true)
    apiClient.defaults.adapter = adapter
    login()
  })
  afterEach(() => {
    cleanup()
    releaseFeed?.()
    clients.forEach((client) => client.clear())
    useAuthStore.getState().logout(false)
    onlineManager.setOnline(true)
    apiClient.defaults.adapter = originalAdapter
    vi.useRealTimers()
  })

  it('marks an item read through HTTP and refreshes the visible unread count', async () => {
    showCenter()
    fireEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mark Update one as read' }))
    await screen.findByText('0 unread')
    expect(screen.queryByRole('button', { name: 'Mark Update one as read' })).not.toBeInTheDocument()
    const request = requests.find((item) => item.url === '/api/v1/announcements/read')
    expect(JSON.parse(request?.data as string)).toEqual({ ids: ['one'] })
    expect(request?.headers.Authorization).toBe('Bearer first')
    expect(getRequests().length).toBeGreaterThan(1)
  })

  it('keeps a failed read unread and allows a successful retry', async () => {
    failRead = true
    showCenter()
    fireEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mark Update one as read' }))
    await screen.findByText('Could not mark notification as read')
    expect(screen.getByText('1 unread')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mark Update one as read' })).toBeEnabled()
    failRead = false
    fireEvent.click(screen.getByRole('button', { name: 'Mark Update one as read' }))
    await screen.findByText('0 unread')
    expect(screen.queryByText('Could not mark notification as read')).not.toBeInTheDocument()
  })

  it('marks all read through HTTP using the server snapshot', async () => {
    notices.push(notice('two'))
    failRead = true
    const { result } = renderHook(() => useMarkAllAnnouncementsRead(), context())
    act(() => result.current.mutate('2026-10-16T01:00:00Z'))
    await waitFor(() => expect(result.current.isError).toBe(true))
    failRead = false
    act(() => result.current.mutate('2026-10-16T01:00:00Z'))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const request = requests.find((item) => item.url === '/api/v1/announcements/read-all')
    expect(JSON.parse(request?.data as string)).toEqual({ through: '2026-10-16T01:00:00Z' })
  })

  it('recovers a failed feed through the visible retry button', async () => {
    failFeed = true
    showCenter()
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }))
    await screen.findByText('Notifications unavailable')
    failFeed = false
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await screen.findByText('Update one')
    expect(screen.getByText('1 unread')).toBeInTheDocument()
    expect(screen.queryByText('Notifications unavailable')).not.toBeInTheDocument()
  })

  it('does not display the previous account read state while the next account feed loads', async () => {
    reads.set('first', new Set(['one']))
    const { result } = renderHook(() => useAnnouncements(0), context())
    await waitFor(() => expect(result.current.data?.items[0].read).toBe(true))
    delayFeedFor = 'second'
    act(() => login('second'))
    await waitFor(() => expect(releaseFeed).toBeDefined())
    expect(result.current.data).toBeUndefined()
    await act(async () => { releaseFeed?.() })
    await waitFor(() => expect(result.current.data?.unreadCount).toBe(1))
    expect(result.current.data?.items[0].read).toBe(false)
    expect(getRequests().at(-1)?.headers.Authorization).toBe('Bearer second')
  })

  it('ignores an old account response that arrives after switching accounts', async () => {
    notices = [notice('private-first')]
    delayFeedFor = 'first'
    const { result } = renderHook(() => useAnnouncements(0), context())
    await waitFor(() => expect(releaseFeed).toBeDefined())
    notices = [notice('private-second')]
    act(() => login('second'))
    await waitFor(() => expect(result.current.data?.items[0].id).toBe('private-second'))
    await act(async () => { releaseFeed?.() })
    expect(result.current.data?.items.map((item) => item.id)).toEqual(['private-second'])
    expect(getRequests()[0].signal?.aborted).toBe(true)
  })

  it('retrieves missed announcements on socket reconnection without waiting for polling', async () => {
    const { result } = renderHook(() => { useAnnouncementUpdates(); return useAnnouncements(0) }, context())
    await waitFor(() => expect(result.current.data?.totalElements).toBe(1))
    act(() => sockets[0].onConnect?.())
    await waitFor(() => expect(getRequests().length).toBe(2))
    await waitFor(() => expect(result.current.isFetching).toBe(false))
    notices.push(notice('missed'))
    // No event callback is delivered while disconnected. Reconnection must reload saved history.
    act(() => sockets[0].onConnect?.())
    await waitFor(() => expect(result.current.data?.items.map((item) => item.id)).toContain('missed'))
    expect(getRequests()).toHaveLength(3)
  })

  it('loads saved announcements after a user signs in offline and reconnects', async () => {
    useAuthStore.getState().logout(false)
    onlineManager.setOnline(false)
    const { result } = renderHook(() => useAnnouncements(0), context())
    act(() => login())
    await waitFor(() => expect(result.current.fetchStatus).toBe('paused'))
    expect(getRequests()).toHaveLength(0)
    notices.push(notice('while-offline'))
    act(() => onlineManager.setOnline(true))
    await waitFor(() => expect(result.current.data?.totalElements).toBe(2))
    expect(result.current.data?.items.map((item) => item.id)).toContain('while-offline')
  })

  it('retrieves missed updates at 60 seconds even when no socket connects', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => { useAnnouncementUpdates(); return useAnnouncements(0) }, context())
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(result.current.data?.totalElements).toBe(1)
    notices.push(notice('poll-only'))
    await act(async () => { await vi.advanceTimersByTimeAsync(59_998) })
    expect(getRequests()).toHaveLength(1)
    expect(result.current.data?.totalElements).toBe(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(2) })
    expect(getRequests()).toHaveLength(2)
    expect(result.current.data?.items.map((item) => item.id)).toContain('poll-only')
    expect(sockets[0].subscribe).not.toHaveBeenCalled()
  })
})
