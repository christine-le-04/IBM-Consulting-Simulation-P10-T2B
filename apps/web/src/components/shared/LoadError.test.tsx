import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AxiosError, type AxiosResponse } from 'axios'
import LoadError from './LoadError'

function renderError(error: unknown, onRetry = vi.fn()) {
  render(<MemoryRouter><LoadError title="Contacts could not be opened" error={error} reassurance="Your research is saved." onRetry={onRetry} /></MemoryRouter>)
  return onRetry
}

describe('LoadError', () => {
  it('offers another attempt when the request never reached the server', () => {
    const onRetry = renderError(new AxiosError('Network Error', 'ERR_NETWORK'))

    expect(screen.getByText('Your research is saved. Check your connection, then try again.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('sends the learner back to the Office when the server refused', () => {
    const refused = new AxiosError('Unprocessable', 'ERR_BAD_REQUEST', undefined, undefined, { status: 422, data: { status: 422 } } as AxiosResponse)
    const onRetry = renderError(refused)

    expect(screen.getByText(/This step is not open for this engagement right now/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to the Office' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
    expect(onRetry).not.toHaveBeenCalled()
  })
})
