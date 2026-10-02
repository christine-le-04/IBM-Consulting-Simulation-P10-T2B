import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import apiClient from '@/api/client'
import { meetingKeys, useRetryMeeting, useReturnToPreparation } from './useMeeting'

vi.mock('@/api/client', () => ({ default: { post: vi.fn() } }))

const mockedPost = vi.mocked(apiClient.post)

// create an isolated query cache for each retry test
function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return { client, wrapper }
}

describe('live meeting retry cache', () => {
  beforeEach(() => vi.resetAllMocks())

  it('starts the new attempt with an empty transcript and clears stale state and choices', async () => {
    const { client, wrapper } = setup()
    const failedTranscript = [{ content: 'The earlier conversation' }]
    const retry = { id: 'meeting-2', engagementId: 'eng-1', status: 'IN_PROGRESS' }
    client.setQueryData(meetingKeys.transcript('meeting-1'), failedTranscript)
    client.setQueryData(meetingKeys.transcript('meeting-2'), failedTranscript)
    client.setQueryData(meetingKeys.personaState('meeting-2'), { trust: 20 })
    client.setQueryData(meetingKeys.responseOptions('meeting-2'), { options: ['Earlier choice'] })
    client.setQueryData(['engagements', 'eng-1'], { state: 'IN_MEETING' })
    mockedPost.mockResolvedValueOnce({ data: retry })
    const { result } = renderHook(() => useRetryMeeting('meeting-1', 'eng-1'), { wrapper })

    await act(async () => { await result.current.mutateAsync() })

    expect(mockedPost).toHaveBeenCalledWith('/api/v1/meetings/meeting-1/retry')
    expect(client.getQueryData(meetingKeys.meeting('meeting-2'))).toEqual(retry)
    expect(client.getQueryData(meetingKeys.transcript('meeting-2'))).toEqual([])
    expect(client.getQueryData(meetingKeys.personaState('meeting-2'))).toBeUndefined()
    expect(client.getQueryData(meetingKeys.responseOptions('meeting-2'))).toBeUndefined()
    expect(client.getQueryData(meetingKeys.transcript('meeting-1'))).toEqual(failedTranscript)
    expect(client.getQueryState(['engagements', 'eng-1'])?.isInvalidated).toBe(true)
  })

  it('keeps the failed attempt and its cached transcript when the retry request fails', async () => {
    const { client, wrapper } = setup()
    const transcript = [{ content: 'The earlier conversation' }]
    client.setQueryData(meetingKeys.transcript('meeting-1'), transcript)
    mockedPost.mockRejectedValueOnce(new Error('Retry unavailable'))
    const { result } = renderHook(() => useRetryMeeting('meeting-1', 'eng-1'), { wrapper })

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toThrow('Retry unavailable')
    })

    expect(client.getQueryData(meetingKeys.transcript('meeting-1'))).toEqual(transcript)
    expect(client.getQueryData(meetingKeys.meeting('meeting-2'))).toBeUndefined()
  })

  it('refreshes the engagement, failed meeting and preparation after returning to the checkpoint', async () => {
    const { client, wrapper } = setup()
    const keys = [['engagements', 'eng-1'], meetingKeys.meeting('meeting-1'), meetingKeys.preparation('eng-1')]
    keys.forEach((key) => client.setQueryData(key, { saved: true }))
    const transcript = [{ content: 'Preserved for review' }]
    client.setQueryData(meetingKeys.transcript('meeting-1'), transcript)
    mockedPost.mockResolvedValueOnce({ data: undefined })
    const { result } = renderHook(() => useReturnToPreparation('meeting-1', 'eng-1'), { wrapper })

    await act(async () => { await result.current.mutateAsync() })

    expect(mockedPost).toHaveBeenCalledWith('/api/v1/meetings/meeting-1/preparation')
    keys.forEach((key) => expect(client.getQueryState(key)?.isInvalidated).toBe(true))
    expect(client.getQueryData(meetingKeys.transcript('meeting-1'))).toEqual(transcript)
  })
})
