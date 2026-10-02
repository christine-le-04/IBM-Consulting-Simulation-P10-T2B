import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import ErrorBoundary from './ErrorBoundary'

function Broken(): never {
  throw new Error('render failed')
}

describe('ErrorBoundary', () => {
  afterEach(() => vi.restoreAllMocks())

  it('shows its children when nothing fails', () => {
    render(<ErrorBoundary><p>Workspace</p></ErrorBoundary>)

    expect(screen.getByText('Workspace')).toBeInTheDocument()
  })

  it('offers a reload instead of a blank page when a child fails to render', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary><Broken /></ErrorBoundary>)

    expect(screen.getByText('This page hit a problem')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
  })
})
