import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AppShell from './AppShell'
import apiClient from '@/api/client'
import { useAuthStore } from '@/store/authStore'

vi.mock('@/api/client', () => ({ default: { post: vi.fn() } }))
vi.mock('@/components/announcements/AnnouncementCenter', () => ({ default: () => null }))

beforeEach(() => {
  vi.resetAllMocks()
  useAuthStore.getState().login({ userId: 'learner', accessToken: 'token', displayName: 'Learner', role: 'LEARNER' })
})
afterEach(() => { cleanup(); useAuthStore.getState().logout() })

function renderShell() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/dashboard']}><AppShell /></MemoryRouter></QueryClientProvider>)
}

describe('logout button', () => {
  it('blocks repeat clicks while revocation is pending', async () => {
    vi.mocked(apiClient.post).mockImplementation(() => new Promise(() => {}))
    renderShell()
    const button = screen.getByRole('button', { name: 'Logout Learner' })
    const user = userEvent.setup()
    await user.click(button)
    await waitFor(() => expect(button).toHaveAttribute('aria-disabled', 'true'))
    await user.click(button)
    expect(apiClient.post).toHaveBeenCalledTimes(1)
    expect(useAuthStore.getState().token).toBe('token')
  })

  it('shows a retryable error and clears the session after a successful retry', async () => {
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('network unavailable')).mockResolvedValueOnce({ status: 204 })
    renderShell()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Logout Learner' }))
    expect(await screen.findByText('Could not sign out')).toBeInTheDocument()
    expect(useAuthStore.getState().token).toBe('token')
    await user.click(screen.getByRole('button', { name: 'Logout Learner' }))
    await waitFor(() => expect(useAuthStore.getState().token).toBeNull())
    expect(apiClient.post).toHaveBeenCalledTimes(2)
  })
})
