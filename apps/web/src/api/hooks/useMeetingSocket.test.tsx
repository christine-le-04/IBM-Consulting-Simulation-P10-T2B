import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useMeetingSocket } from './useMeetingSocket'

// captures the STOMP client the hook creates so tests can fire its callbacks
const stomp = vi.hoisted(() => ({ clients: [] as Array<Record<string, (...args: never[]) => void>> }))
vi.mock('@stomp/stompjs', () => ({
  Client: class {
    activate = vi.fn()
    deactivate = vi.fn()
    subscribe = vi.fn()
    publish = vi.fn()
    constructor() {
      stomp.clients.push(this as never)
    }
  },
}))

function renderSocket() {
  const queryClient = new QueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  const hook = renderHook(() => useMeetingSocket('meeting-1'), { wrapper })
  return { ...hook, client: stomp.clients[stomp.clients.length - 1] }
}

describe('live meeting connection errors', () => {
  beforeEach(() => {
    stomp.clients.length = 0
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('explains a failed connection without infrastructure detail', () => {
    const { result, client } = renderSocket()
    act(() => client.onWebSocketError())

    expect(result.current.error).toBe('Unable to connect to the live meeting. Check your connection; reconnecting automatically.')
  })

  it('keeps the broker’s own error text out of the meeting', () => {
    const { result, client } = renderSocket()
    act(() => client.onStompError({ headers: { message: 'Failed to send message to ExecutorSubscribableChannel[clientInboundChannel]' } } as never))

    expect(result.current.error).toBe('The live meeting hit a connection problem. Wait a moment, then send your message again.')
  })

  it('asks the learner to wait when they send before the connection is up', async () => {
    const { result, client } = renderSocket()
    let delivered: boolean | undefined
    await act(async () => { delivered = await result.current.sendMessage('Hello') })

    expect(delivered).toBe(false)
    expect(result.current.error).toBe('The live meeting is still connecting. Try again in a moment.')
    expect(client.publish).not.toHaveBeenCalled()
  })

  it('does not let a failed reconnect replace what the learner was last told', async () => {
    const { result, client } = renderSocket()
    await act(async () => { await result.current.sendMessage('Hello') })
    act(() => client.onWebSocketClose())

    expect(result.current.error).toBe('The live meeting is still connecting. Try again in a moment.')
  })

  it('says the connection was lost when a live connection drops', () => {
    const { result, client } = renderSocket()
    act(() => client.onConnect())
    act(() => client.onWebSocketClose())

    expect(result.current.error).toBe('The live meeting connection was lost. Reconnecting automatically; wait for the connection before sending again.')
  })
})
