import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Engagement } from '@/api/types'
import EngagementBar from './EngagementBar'
import { useShellStore } from './shellStore'

vi.mock('@/api/hooks/useLeads', () => ({ useResearch: () => ({ data: [] }) }))
vi.mock('./useShellEngagement', () => ({
  useShellEngagement: () => ({
    engagementId: 'eng-1',
    engagement: { id: 'eng-1', phase: 'CLIENT_INTELLIGENCE' } as Engagement,
    viewingPhase: 'CLIENT_INTELLIGENCE',
  }),
}))
vi.mock('./useClientCue', () => ({
  useClientCue: () => ({ who: 'The client', cue: { tone: 'unmet', text: 'Research the company.' } }),
}))

describe('EngagementBar case file toggle', () => {
  beforeEach(() => useShellStore.getState().resetForPage())

  it('opens and closes the case file from the header and reports its state', async () => {
    const user = userEvent.setup()
    render(<EngagementBar />)

    const show = screen.getByRole('button', { name: /Show case file/ })
    expect(show).toHaveAttribute('aria-expanded', 'false')
    expect(show).toHaveAttribute('aria-controls', 'case-file-panel')
    await user.click(show)

    expect(useShellStore.getState().caseFileOpen).toBe(true)
    const hide = screen.getByRole('button', { name: /Hide case file/ })
    expect(hide).toHaveAttribute('aria-expanded', 'true')
    await user.click(hide)

    expect(useShellStore.getState().caseFileOpen).toBe(false)
    expect(screen.getByRole('button', { name: /Show case file/ })).toHaveAttribute('aria-expanded', 'false')
  })

  it('updates the header when the drawer is closed elsewhere', async () => {
    const user = userEvent.setup()
    render(<EngagementBar />)
    await user.click(screen.getByRole('button', { name: /Show case file/ }))

    act(() => useShellStore.getState().setCaseFileOpen(false))

    expect(screen.getByRole('button', { name: /Show case file/ })).toHaveAttribute('aria-expanded', 'false')
  })
})
