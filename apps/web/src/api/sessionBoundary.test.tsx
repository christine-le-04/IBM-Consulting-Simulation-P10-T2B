import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios, { AxiosError, type AxiosAdapter, type AxiosResponse } from 'axios'
import apiClient from '@/api/client'
import SessionQueryProvider from './SessionQueryProvider'
import { useSessionBoundary } from './sessionBoundary'
import { useAuthStore } from '@/store/authStore'
import { useEngagementStore } from '@/store/engagementStore'
import { useShellStore } from '@/components/shell/shellStore'
import type { Engagement } from '@/api/types'

const originalAdapter = apiClient.defaults.adapter

function login(userId: string, accessToken = `${userId}-token`) {
  useAuthStore.getState().login({ userId, accessToken, displayName: userId, role: 'LEARNER' })
}

beforeEach(() => login('account-a'))
afterEach(() => {
  cleanup()
  apiClient.defaults.adapter = originalAdapter
  useAuthStore.getState().logout()
})

describe('session privacy boundary', () => {
  it('clears query and mutation caches and UI stores on logout', () => {
    const previous = useSessionBoundary.getState()
    previous.queryClient.setQueryData(['portfolio', 'summary'], { private: 'account-a' })
    previous.queryClient.getMutationCache().build(previous.queryClient, { mutationKey: ['private-draft'] })
    useEngagementStore.getState().setActiveEngagement({ id: 'private-engagement' } as Engagement)
    useShellStore.getState().setMentorLine('private coaching')
    useShellStore.getState().setMapOpen(true)

    useAuthStore.getState().logout()

    expect(previous.signal.aborted).toBe(true)
    expect(previous.queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(previous.queryClient.getMutationCache().getAll()).toHaveLength(0)
    expect(useEngagementStore.getState().activeEngagement).toBeNull()
    expect(useShellStore.getState().mentorLine).toBeNull()
    expect(useShellStore.getState().mapOpen).toBe(false)
    expect(useSessionBoundary.getState().queryClient).not.toBe(previous.queryClient)
  })

  it('isolates identical query keys when switching accounts directly', () => {
    const previous = useSessionBoundary.getState().queryClient
    previous.setQueryData(['admin', 'users'], ['private-account-a-user'])
    login('account-b')
    const current = useSessionBoundary.getState().queryClient
    expect(current.getQueryData(['admin', 'users'])).toBeUndefined()
    // A late callback which retained the old client cannot populate the new one.
    previous.setQueryData(['admin', 'users'], ['late-account-a-user'])
    expect(current.getQueryData(['admin', 'users'])).toBeUndefined()
  })

  it('rotates the boundary for token and role changes but retains it for onboarding', () => {
    const original = useSessionBoundary.getState()
    useAuthStore.getState().completeOnboarding()
    expect(useSessionBoundary.getState()).toBe(original)
    login('account-a', 'replacement-token')
    const replacement = useSessionBoundary.getState()
    expect(replacement.revision).toBe(original.revision + 1)
    useAuthStore.setState({ role: 'REVIEWER' })
    expect(useSessionBoundary.getState().revision).toBe(replacement.revision + 1)
  })

  it('cancels active queries so late results cannot restore the previous cache', async () => {
    const previous = useSessionBoundary.getState().queryClient
    let finish!: (value: string) => void
    const pending = previous.fetchQuery({
      queryKey: ['portfolio'],
      queryFn: () => new Promise<string>((resolve) => { finish = resolve }),
    }).catch(() => undefined)
    login('account-b')
    finish('private-account-a')
    await pending
    expect(previous.getQueryData(['portfolio'])).toBeUndefined()
    expect(useSessionBoundary.getState().queryClient.getQueryData(['portfolio'])).toBeUndefined()
  })

  it('aborts API requests and rejects late mutation responses', async () => {
    let finish!: () => void
    let requestStarted!: () => void
    const started = new Promise<void>((resolve) => { requestStarted = resolve })
    let requestSignal: AbortSignal | undefined
    apiClient.defaults.adapter = ((config) => new Promise<AxiosResponse>((resolve) => {
      requestSignal = config.signal as AbortSignal
      finish = () => resolve({ data: { private: 'account-a' }, status: 200, statusText: 'OK', headers: {}, config })
      requestStarted()
    })) satisfies AxiosAdapter
    const pending = apiClient.post('/private-draft').catch((error: unknown) => error)
    await started
    login('account-b')
    expect(requestSignal?.aborted).toBe(true)
    finish()
    expect(axios.isCancel(await pending)).toBe(true)
    expect(useAuthStore.getState().userId).toBe('account-b')
  })

  it('preserves caller cancellation signals', async () => {
    const caller = new AbortController()
    let finish!: () => void
    let requestStarted!: () => void
    const started = new Promise<void>((resolve) => { requestStarted = resolve })
    let requestSignal: AbortSignal | undefined
    apiClient.defaults.adapter = ((config) => new Promise<AxiosResponse>((resolve) => {
      requestSignal = config.signal as AbortSignal
      finish = () => resolve({ data: {}, status: 200, statusText: 'OK', headers: {}, config })
      requestStarted()
    })) satisfies AxiosAdapter
    const pending = apiClient.get('/private', { signal: caller.signal }).catch((error: unknown) => error)
    await started
    caller.abort()
    expect(requestSignal?.aborted).toBe(true)
    finish()
    expect(axios.isCancel(await pending)).toBe(true)
  })

  it('captures credentials immediately and prevents a late 401 from logging out the new account', async () => {
    let rejectRequest!: () => void
    let authorization: unknown
    apiClient.defaults.adapter = ((config) => new Promise<AxiosResponse>((_, reject) => {
      authorization = config.headers.Authorization
      rejectRequest = () => reject(new AxiosError('Unauthorized', undefined, config, undefined, {
        data: {}, status: 401, statusText: 'Unauthorized', headers: {}, config,
      }))
    })) satisfies AxiosAdapter
    const pending = apiClient.get('/private').catch((error: unknown) => error)
    // Switching in the same tick must not attach B's token to A's request.
    login('account-b')
    expect(authorization).toBe('Bearer account-a-token')
    rejectRequest()
    expect(axios.isCancel(await pending)).toBe(true)
    expect(useAuthStore.getState().userId).toBe('account-b')
  })

  it('rehydrated account changes clear the old session too', async () => {
    const previous = useSessionBoundary.getState()
    localStorage.setItem('auth-storage', JSON.stringify({ state: {
      token: 'account-b-token', userId: 'account-b', role: 'LEARNER', displayName: 'B',
    }, version: 0 }))
    await useAuthStore.persist.rehydrate()
    expect(previous.signal.aborted).toBe(true)
    expect(useAuthStore.getState().userId).toBe('account-b')
  })

  it('remounts local UI and never renders the previous portfolio for a new account', () => {
    function PrivatePage() {
      const [draft, setDraft] = useState('')
      const portfolio = useQuery({ queryKey: ['portfolio'], queryFn: () => new Promise<string>(() => {}) })
      return <><span>{portfolio.data ?? 'Loading'}</span><input aria-label="Draft" value={draft} onChange={(event) => setDraft(event.target.value)} /></>
    }
    useSessionBoundary.getState().queryClient.setQueryData(['portfolio'], 'Account A portfolio')
    render(<SessionQueryProvider><PrivatePage /></SessionQueryProvider>)
    expect(screen.getByText('Account A portfolio')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Draft'), { target: { value: 'Account A private draft' } })
    expect(screen.getByLabelText('Draft')).toHaveValue('Account A private draft')
    act(() => login('account-b'))
    expect(screen.queryByText('Account A portfolio')).not.toBeInTheDocument()
    expect(screen.getByText('Loading')).toBeInTheDocument()
    expect(screen.getByLabelText('Draft')).toHaveValue('')
  })
})
