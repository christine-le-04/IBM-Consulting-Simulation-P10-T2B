import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import AdminNavigation from './AdminNavigation'

afterEach(() => {
  cleanup()
  useAuthStore.setState({ role: null })
})

describe('AdminNavigation', () => {
  it('groups the administrator pages and keeps learner-run detail under learner progress', () => {
    useAuthStore.setState({ role: 'ADMINISTRATOR' })

    render(
      <MemoryRouter initialEntries={['/dashboard/admin/learners/engagement-1']}>
        <AdminNavigation />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Learning journeys' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Progression and badges' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'People and access' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Learner progress' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'AI delivery' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Audit log' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Announcements' })).toBeInTheDocument()
  })

  it('only shows pages available to the current role', () => {
    useAuthStore.setState({ role: 'SCENARIO_AUTHOR' })

    render(
      <MemoryRouter initialEntries={['/dashboard/admin/scenarios']}>
        <AdminNavigation />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Learning journeys' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'People and access' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Announcements' })).not.toBeInTheDocument()
  })

  it('opens the vertical navigation as an overlay menu and closes after navigation', () => {
    useAuthStore.setState({ role: 'ADMINISTRATOR' })

    render(
      <MemoryRouter initialEntries={['/dashboard/admin']}>
        <AdminNavigation />
      </MemoryRouter>,
    )

    const toggle = screen.getByRole('button', { name: 'Admin navigation' })
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(screen.getByRole('link', { name: 'People and access' }))
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })
})
