import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import apiClient from '@/api/client'
import { useAuthStore } from '@/store/authStore'
import ScenarioAnnouncementPage from './ScenarioAnnouncementPage'

vi.mock('@/api/client', () => ({ default: { get: vi.fn() } }))
function show() {
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={['/dashboard/scenarios/example']}><Routes>
      <Route path="/dashboard/scenarios/:scenarioId" element={<ScenarioAnnouncementPage />} />
    </Routes></MemoryRouter>
  </QueryClientProvider>)
}
describe('Scenario announcement destination', () => {
  beforeEach(() => { vi.clearAllMocks(); useAuthStore.setState({ userId: 'learner' }) })
  it('loads the current scenario through the access-controlled API', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { title: 'Current scenario', description: 'Briefing', status: 'ACTIVE' } })
    show()
    expect(await screen.findByRole('heading', { name: 'Current scenario' })).toBeInTheDocument()
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/scenarios/example', expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(screen.getByRole('link', { name: 'Open your Office' })).toHaveAttribute('href', '/dashboard')
  })
  it('provides an Office fallback when access is lost or a scenario is removed', async () => {
    vi.mocked(apiClient.get).mockRejectedValue({ response: { status: 404 } })
    show()
    expect(await screen.findByText('Scenario unavailable')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open your Office' })).toBeInTheDocument()
  })
  it('explains that archived scenarios only support existing runs', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { title: 'Past scenario', status: 'ARCHIVED' } })
    show()
    expect(await screen.findByText(/You can continue existing runs/)).toBeInTheDocument()
  })
})
