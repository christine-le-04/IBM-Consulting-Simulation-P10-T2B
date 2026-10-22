import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { useTour } from '@reactour/tour'
import ObjectiveTourAction from './ObjectiveTourAction'

vi.mock('@reactour/tour', () => ({ useTour: vi.fn() }))

const setIsOpen = vi.fn()
const setCurrentStep = vi.fn()
const setSteps = vi.fn()
const steps = [{ selector: '.tour-target', content: 'A tour step' }]

describe('ObjectiveTourAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = '<div id="objective-tour-action-slot"></div><div class="tour-target"></div>'
    vi.mocked(useTour).mockReturnValue({
      isOpen: false,
      setIsOpen,
      setCurrentStep,
      setSteps,
      steps,
    } as unknown as ReturnType<typeof useTour>)
  })

  it('reopens the walkthrough from its first step', async () => {
    render(<ObjectiveTourAction />)

    await waitFor(() => expect(document.querySelector('button[aria-label="Replay walkthrough"]')).toBeInTheDocument())
    fireEvent.click(document.querySelector('button[aria-label="Replay walkthrough"]')!)

    expect(setCurrentStep).toHaveBeenCalledWith(0)
    expect(setIsOpen).toHaveBeenCalledWith(true)
  })

  it('closes the walkthrough when it is already open', async () => {
    vi.mocked(useTour).mockReturnValue({
      isOpen: true,
      setIsOpen,
      setCurrentStep,
      setSteps,
      steps,
    } as unknown as ReturnType<typeof useTour>)
    render(<ObjectiveTourAction />)

    await waitFor(() => expect(document.querySelector('button[aria-label="Close walkthrough"]')).toBeInTheDocument())
    fireEvent.click(document.querySelector('button[aria-label="Close walkthrough"]')!)

    expect(setIsOpen).toHaveBeenCalledWith(false)
    expect(setCurrentStep).not.toHaveBeenCalled()
  })
})
