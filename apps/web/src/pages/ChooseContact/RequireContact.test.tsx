import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RequireContact from './RequireContact'
import { useEngagement } from '@/api/hooks/useEngagements'
import type { Engagement } from '@/api/types'

vi.mock('@/api/hooks/useEngagements', () => ({ useEngagement: vi.fn() }))

function setup(overrides: Partial<Engagement> = {}) {
  vi.mocked(useEngagement).mockReturnValue({
    data: { state: 'HYPOTHESIS_READY', contactPersonaId: null, outreachRound: 1, ...overrides }, isLoading: false,
  } as unknown as ReturnType<typeof useEngagement>)
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/dashboard/engagements/eng-1/outreach']}>
      <Routes>
        <Route path="/dashboard/engagements/:engagementId/outreach" element={<RequireContact><div>Outreach workspace</div></RequireContact>} />
        <Route path="/dashboard/engagements/:engagementId/contact" element={<div>Choose contact</div>} />
        <Route path="/dashboard/engagements/:engagementId/intelligence" element={<div>Research desk</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RequireContact direct navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setup()
  })

  it('waits for the engagement before opening outreach or redirecting', () => {
    vi.mocked(useEngagement).mockReturnValue({ isLoading: true } as unknown as ReturnType<typeof useEngagement>)
    renderPage()

    expect(screen.queryByText('Outreach workspace')).not.toBeInTheDocument()
    expect(screen.queryByText('Choose contact')).not.toBeInTheDocument()
  })

  it.each(['HYPOTHESIS_READY', 'OUTREACHING'] as const)('asks for a contact when none is chosen in %s', (state) => {
    setup({ state })
    renderPage()

    expect(screen.getByText('Choose contact')).toBeInTheDocument()
    expect(screen.queryByText('Outreach workspace')).not.toBeInTheDocument()
  })

  it('returns to research after every contact has failed', () => {
    setup({ outreachRound: 2 })
    renderPage()

    expect(screen.getByText('Research desk')).toBeInTheDocument()
  })

  it('opens outreach once a contact has been chosen', () => {
    setup({ contactPersonaId: 'p-2' })
    renderPage()

    expect(screen.getByText('Outreach workspace')).toBeInTheDocument()
  })

  it('keeps earlier correspondence reachable after a meeting is secured', () => {
    setup({ state: 'MEETING_SECURED' })
    renderPage()

    expect(screen.getByText('Outreach workspace')).toBeInTheDocument()
  })
})
