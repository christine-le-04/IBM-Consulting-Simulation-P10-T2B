import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { Outlet } from 'react-router-dom'
import App from './App'
import { useAuthStore, sessionEventKey } from '@/store/authStore'
import { refreshSession } from '@/api/refreshSession'

vi.mock('@/api/refreshSession', () => ({ refreshSession: vi.fn() }))

// Keep the real route guards; page data and the shell are covered separately.
vi.mock('@/components/layout/AppShell', () => ({ default: () => <Outlet /> }))
vi.mock('@/components/shared/LoadingState', () => ({ default: () => <div>Loading...</div> }))
vi.mock('@/pages/ChooseContact/RequireContact', () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
vi.mock('@/pages/Landing/LandingPage', () => ({ default: () => <div>Landing page</div> }))
vi.mock('@/pages/Auth/LoginPage', () => ({ default: () => <div>Sign in page</div> }))
vi.mock('@/pages/Auth/RegisterPage', () => ({ default: () => <div>Registration page</div> }))
vi.mock('@/pages/Auth/VerifyEmailPage', () => ({ default: () => <div>Confirmation page</div> }))
vi.mock('@/pages/Auth/ForgotPasswordPage', () => ({ default: () => <div>Password request page</div> }))
vi.mock('@/pages/Auth/ResetPasswordPage', () => ({ default: () => <div>Password reset page</div> }))
vi.mock('@/pages/CommandCentre/CommandCentrePage', () => ({ default: () => <div>Command centre</div> }))
vi.mock('@/pages/Admin/AdminConsolePage', () => ({ default: () => <div>Admin console</div> }))
vi.mock('@/pages/Admin/ScenarioBuilderPage', () => ({ default: () => <div>Scenario builder</div> }))
vi.mock('@/pages/Admin/UserManagementPage', () => ({ default: () => <div>User management</div> }))
vi.mock('@/pages/Admin/AiOperationsPage', () => ({ default: () => <div>AI operations</div> }))
vi.mock('@/pages/Admin/AuditLogPage', () => ({ default: () => <div>Audit log</div> }))
vi.mock('@/pages/Admin/AnnouncementsPage', () => ({ default: () => <div>Admin announcements</div> }))
vi.mock('@/pages/Admin/AchievementBuilderPage', () => ({ default: () => <div>Achievement builder</div> }))

function renderAt(path: string, role: string | null = null) {
  window.history.replaceState(null, '', path)
  useAuthStore.setState({ token: role ? 'test-token' : null, role })
  return render(<App />)
}

beforeEach(() => {
  vi.mocked(refreshSession).mockReset()
  useAuthStore.getState().logout()
  window.history.replaceState(null, '', '/')
})

describe('App account route access', () => {
  it.each(['auth-storage', null])('signs out when another tab clears authentication storage (%s)', async (key) => {
    renderAt('/dashboard', 'LEARNER')
    expect(await screen.findByText('Command centre')).toBeInTheDocument()
    localStorage.removeItem('auth-storage')
    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', { key, storageArea: localStorage }))
    })
    expect(await screen.findByText('Sign in page')).toBeInTheDocument()
    expect(useAuthStore.getState().token).toBeNull()
  })

  it('redirects an open login page when another tab signs in', async () => {
    renderAt('/login')
    expect(await screen.findByText('Sign in page')).toBeInTheDocument()
    vi.mocked(refreshSession).mockImplementation(async () => {
      const response = { accessToken: 'other-tab-token', userId: 'learner-1', role: 'LEARNER', displayName: 'Learner' }
      useAuthStore.getState().renew(response)
      return response
    })

    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', { key: sessionEventKey, newValue: JSON.stringify({ type: 'login', nonce: 'new-session' }), storageArea: localStorage }))
    })

    expect(await screen.findByText('Command centre')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/dashboard')
  })

  it('sends an unauthenticated visitor to sign in before opening the dashboard', async () => {
    renderAt('/dashboard')

    expect(await screen.findByText('Sign in page')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/login')
    expect(screen.queryByText('Command centre')).not.toBeInTheDocument()
  })

  it.each(['/login', '/register', '/verify-email', '/forgot-password', '/reset-password'])('sends an authenticated visitor from %s to the dashboard', async (path) => {
    renderAt(path, 'LEARNER')

    expect(await screen.findByText('Command centre')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/dashboard')
  })

  it('returns an unknown public route to the landing page', async () => {
    renderAt('/does-not-exist')

    expect(await screen.findByText('Landing page')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
  })
})

describe('App admin route access', () => {
  it.each(['/dashboard/admin', '/dashboard/admin/scenarios', '/dashboard/admin/users', '/dashboard/admin/ai-operations', '/dashboard/admin/achievements', '/dashboard/admin/audit-log', '/dashboard/admin/announcements'])('denies a learner direct access to %s', async (path) => {
    renderAt(path, 'LEARNER')

    expect(await screen.findByText('Command centre')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/dashboard')
  })

  it.each([
    ['SCENARIO_AUTHOR', '/dashboard/admin/scenarios', 'Scenario builder'],
    ['REVIEWER', '/dashboard/admin/ai-operations', 'AI operations'],
    ['ADMINISTRATOR', '/dashboard/admin/users', 'User management'],
    ['ADMINISTRATOR', '/dashboard/admin/audit-log', 'Audit log'],
    ['ADMINISTRATOR', '/dashboard/admin/announcements', 'Admin announcements'],
    ['ADMINISTRATOR', '/dashboard/admin/achievements', 'Achievement builder'],
  ])('allows %s to open %s', async (role, path, page) => {
    renderAt(path, role)

    expect(await screen.findByText(page)).toBeInTheDocument()
    expect(window.location.pathname).toBe(path)
  })

  it.each([
    ['SCENARIO_AUTHOR', '/dashboard/admin/users'],
    ['SCENARIO_AUTHOR', '/dashboard/admin/audit-log'],
    ['REVIEWER', '/dashboard/admin/audit-log'],
    ['SCENARIO_AUTHOR', '/dashboard/admin/announcements'],
    ['REVIEWER', '/dashboard/admin/announcements'],
    ['REVIEWER', '/dashboard/admin/scenarios'],
    ['REVIEWER', '/dashboard/admin/achievements'],
  ])('denies %s direct access to %s', async (role, path) => {
    renderAt(path, role)

    expect(await screen.findByText('Command centre')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/dashboard')
  })
})
