import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore, sessionEventKey } from './authStore'

const access = { accessToken: 'sensitive-access-token', userId: 'learner', displayName: 'Learner', role: 'LEARNER', sessionId: 'server-session', expiresAt: Date.now() + 900000 }

beforeEach(() => { useAuthStore.getState().logout(false); localStorage.clear(); sessionStorage.clear() })

describe('memory-only credentials', () => {
  it('never persists access credentials and broadcasts only a session notification', () => {
    useAuthStore.getState().login(access)
    expect(useAuthStore.getState().token).toBe(access.accessToken)
    expect(localStorage.getItem('auth-storage')).toBeNull()
    expect(JSON.parse(localStorage.getItem(sessionEventKey)!)).toEqual({ type: 'login', nonce: expect.any(String) })
    expect(JSON.stringify(localStorage)).not.toContain(access.accessToken)
    expect(JSON.stringify(sessionStorage)).not.toContain(access.accessToken)
  })

  it('renewal does not cause cross-tab broadcast loops', () => {
    useAuthStore.getState().renew(access)
    expect(localStorage.getItem(sessionEventKey)).toBeNull()
    useAuthStore.getState().logout(false)
    expect(localStorage.getItem(sessionEventKey)).toBeNull()
  })

  it('logout clears memory and sends no secrets to other tabs', () => {
    useAuthStore.getState().login(access)
    useAuthStore.getState().logout()
    expect(useAuthStore.getState().token).toBeNull()
    expect(useAuthStore.getState().sessionId).toBeNull()
    expect(JSON.parse(localStorage.getItem(sessionEventKey)!)).toEqual({ type: 'logout', nonce: expect.any(String) })
  })

  it('discards persisted legacy JWTs instead of restoring them', async () => {
    localStorage.setItem('auth-storage', JSON.stringify({ state: { token: 'legacy-secret' }, version: 0 }))
    vi.resetModules()
    const fresh = await import('./authStore')
    expect(localStorage.getItem('auth-storage')).toBeNull()
    expect(fresh.useAuthStore.getState().token).toBeNull()
  })
})
