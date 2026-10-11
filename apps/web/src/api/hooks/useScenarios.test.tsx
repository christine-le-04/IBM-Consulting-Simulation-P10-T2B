import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import apiClient from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import { useScenarioCatalog } from './useScenarios'

vi.mock('@/api/client', () => ({ default: { get: vi.fn() } }))

const filters = { page: 0, size: 8 }
const empty = { items: [], totalElements: 0, totalPages: 0, page: 0, size: 8 }
const available = { ...empty, items: [{ id: 'scenario-1' }], totalElements: 1, totalPages: 1 }

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return { client, wrapper }
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.useFakeTimers()
  useAuthStore.setState({ userId: 'learner-1' })
})
afterEach(() => vi.useRealTimers())

describe('scenario catalogue recovery', () => {
  it('rechecks an empty catalogue and stops polling once scenarios arrive', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: empty }).mockResolvedValue({ data: available })
    const { client, wrapper } = setup()
    const { result, unmount } = renderHook(() => useScenarioCatalog(filters), { wrapper })
    await act(async () => { await vi.advanceTimersByTimeAsync(100) })
    expect(result.current.data?.totalElements).toBe(0)
    await act(async () => { await vi.advanceTimersByTimeAsync(10_100) })
    expect(result.current.data?.totalElements).toBe(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000) })
    expect(apiClient.get).toHaveBeenCalledTimes(2)
    unmount()
    client.clear()
  })

  it('does not reuse another account’s catalogue or placeholder data', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: available })
      .mockImplementationOnce(() => new Promise(() => {}))
    const { client, wrapper } = setup()
    const { result, unmount } = renderHook(() => useScenarioCatalog(filters), { wrapper })
    await act(async () => { await vi.advanceTimersByTimeAsync(100) })
    expect(result.current.data?.totalElements).toBe(1)
    act(() => useAuthStore.setState({ userId: 'learner-2' }))
    expect(result.current.data).toBeUndefined()
    expect(result.current.isLoading).toBe(true)
    expect(apiClient.get).toHaveBeenCalledTimes(2)
    unmount()
    client.clear()
  })
})
