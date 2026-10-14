import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import AuthSessionLifecycle from './AuthSessionLifecycle'
import { refreshSession } from './refreshSession'
import { useAuthStore } from '@/store/authStore'

vi.mock('./refreshSession', () => ({ refreshSession: vi.fn() }))
vi.mock('@/components/shared/LoadingState', () => ({ default: () => <span>Restoring session</span> }))

beforeEach(() => { vi.resetAllMocks(); useAuthStore.getState().logout(false) })
afterEach(() => { cleanup(); vi.useRealTimers(); useAuthStore.getState().logout(false) })

describe('session restore and renewal', () => {
  it('waits for refresh before rendering protected route content', async () => {
    let finish!: () => void
    const pending = new Promise<never>((resolve) => { finish = () => resolve(undefined as never) })
    vi.mocked(refreshSession).mockReturnValue(pending)
    render(<StrictMode><AuthSessionLifecycle><span>Route content</span></AuthSessionLifecycle></StrictMode>)
    expect(screen.getByText('Restoring session')).toBeInTheDocument()
    expect(screen.queryByText('Route content')).not.toBeInTheDocument()
    await act(async () => { finish() })
    expect(screen.getByText('Route content')).toBeInTheDocument()
  })

  it('allows sign-in pages to render when there is no refresh session', async () => {
    vi.mocked(refreshSession).mockRejectedValue(new Error('no cookie'))
    render(<AuthSessionLifecycle><span>Sign in</span></AuthSessionLifecycle>)
    expect(await screen.findByText('Sign in')).toBeInTheDocument()
  })

  it('renews access before expiry without resetting the account', async () => {
    vi.useFakeTimers()
    useAuthStore.getState().renew({ accessToken: 'access', userId: 'learner', displayName: 'Learner', role: 'LEARNER', sessionId: 'session', expiresAt: Date.now() + 90000 })
    vi.mocked(refreshSession).mockResolvedValue({ accessToken: 'fresh', userId: 'learner', displayName: 'Learner', role: 'LEARNER' })
    render(<AuthSessionLifecycle><span>Workspace</span></AuthSessionLifecycle>)
    await act(async () => { await vi.advanceTimersByTimeAsync(60000) })
    expect(refreshSession).toHaveBeenCalledTimes(1)
    expect(useAuthStore.getState().userId).toBe('learner')
  })
})
