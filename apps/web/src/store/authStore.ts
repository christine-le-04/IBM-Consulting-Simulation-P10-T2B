import { create } from 'zustand'
import type { TokenResponse } from '@/api/types'

interface AuthState {
  token: string | null
  userId: string | null
  displayName: string | null
  role: string | null
  onboardingRequired: boolean
  sessionId: string | null
  expiresAt: number
  login: (response: TokenResponse) => void
  completeOnboarding: () => void
  renew: (response: TokenResponse) => void
  logout: (broadcast?: boolean) => void
  isAuthenticated: () => boolean
}

export const sessionEventKey = 'auth-session-event'

function broadcast(type: 'login' | 'logout') {
  try {
    // Notification only: access and refresh credentials never enter storage.
    localStorage.setItem(sessionEventKey, JSON.stringify({ type, nonce: crypto.randomUUID() }))
  } catch { /* Private browsing may disable storage; authentication still works. */ }
}

try { localStorage.removeItem('auth-storage') } catch { /* Remove legacy persisted JWTs. */ }

export const useAuthStore = create<AuthState>()((set, get) => {
  const apply = (response: TokenResponse) => set({
    token: response.accessToken,
    userId: response.userId,
    displayName: response.displayName,
    role: response.role,
    onboardingRequired: response.onboardingRequired ?? false,
    sessionId: response.sessionId ?? null,
    expiresAt: response.expiresAt ?? 0,
  })
  return {
      token: null,
      userId: null,
      displayName: null,
      role: null,
      onboardingRequired: false,
      sessionId: null,
      expiresAt: 0,
      login: (response) => { apply(response); broadcast('login') },
      renew: apply,
      completeOnboarding: () => set({ onboardingRequired: false }),
      logout: (notify = true) => {
        set({ token: null, userId: null, displayName: null, role: null, onboardingRequired: false, sessionId: null, expiresAt: 0 })
        if (notify) broadcast('logout')
      },
      isAuthenticated: () => Boolean(get().token),
  }
})
