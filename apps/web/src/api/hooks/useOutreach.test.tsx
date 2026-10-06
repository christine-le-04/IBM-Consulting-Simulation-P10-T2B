import type { PropsWithChildren } from 'react'
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import apiClient from '@/api/client'
import { useSendOutreach } from './useOutreach'

vi.mock('@/api/client', () => ({ default: { post: vi.fn() } }))

function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return renderHook(() => useSendOutreach('eng-1'), {
    wrapper: ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  })
}

describe('outreach provider recovery', () => {
  beforeEach(() => vi.clearAllMocks())

  it('retries one 503 with the same email and idempotency key', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce({ isAxiosError: true, response: { status: 503 } })
      .mockResolvedValueOnce({ data: { id: 'email-1' } })
    const { result } = setup()
    await act(async () => { await result.current.mutateAsync({ subject: 'Subject', body: 'Body' }) })
    expect(apiClient.post).toHaveBeenCalledTimes(2)
    const firstRequest = vi.mocked(apiClient.post).mock.calls[0][1]
    expect(firstRequest).toMatchObject({ subject: 'Subject', body: 'Body', requestId: expect.any(String) })
    expect(vi.mocked(apiClient.post).mock.calls[1][1]).toEqual(firstRequest)
  })

  it('stops after two provider failures and preserves the error', async () => {
    const error = { isAxiosError: true, response: { status: 503 } }
    vi.mocked(apiClient.post).mockRejectedValue(error)
    const { result } = setup()
    await act(async () => {
      await expect(result.current.mutateAsync({ subject: 'Subject', body: 'Body' })).rejects.toEqual(error)
    })
    expect(apiClient.post).toHaveBeenCalledTimes(2)
  })

  it('does not retry validation failures', async () => {
    const error = { isAxiosError: true, response: { status: 422 } }
    vi.mocked(apiClient.post).mockRejectedValue(error)
    const { result } = setup()
    await act(async () => {
      await expect(result.current.mutateAsync({ subject: 'Subject', body: 'Body' })).rejects.toEqual(error)
    })
    expect(apiClient.post).toHaveBeenCalledTimes(1)
  })
})
