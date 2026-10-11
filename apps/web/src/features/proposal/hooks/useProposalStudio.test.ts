import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useProposalStudio } from './useProposalStudio'

const resetSubmit = vi.fn()
const submission = vi.hoisted(() => ({ error: null as unknown }))

vi.mock('@/api/hooks/useProposal', () => {
  const mutation = () => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue(undefined), reset: vi.fn(), isPending: false, isError: false })
  return {
    useProposalWorkspace: () => ({ data: { sources: [], proposal: undefined }, refetch: vi.fn() }),
    useSaveProposalDraft: mutation,
    useProposalReview: mutation,
    useProposalChallenge: mutation,
    useReviseProposal: mutation,
    useSubmitProposal: () => ({ ...mutation(), reset: resetSubmit, isError: true, error: submission.error }),
  }
})

describe('useProposalStudio', () => {
  beforeEach(() => { submission.error = null })
  it('clears a rejected submit once the learner edits the draft', () => {
    const { result } = renderHook(() => useProposalStudio('eng-1'))
    resetSubmit.mockClear()

    act(() => result.current.updateDraft((current) => ({ ...current, problemStatement: 'Claims backlog doubled since March' })))

    expect(resetSubmit).toHaveBeenCalledTimes(1)
  })

  it('retains validation errors through incomplete and complete edits', () => {
    submission.error = { isAxiosError: true, response: { status: 422, data: {
      violations: { PROBLEM_REQUIRED: 'Describe the problem.', OUTCOME_REQUIRED: 'Add an outcome.' },
    } } }
    const { result } = renderHook(() => useProposalStudio('eng-2'))
    resetSubmit.mockClear()

    act(() => result.current.updateDraft((current) => ({ ...current, problemStatement: 'Client problem' })))
    expect(resetSubmit).not.toHaveBeenCalled()
    act(() => result.current.updateDraft((current) => ({ ...current, problemStatement: 'Claims backlog doubled since March' })))
    expect(resetSubmit).not.toHaveBeenCalled()
  })
})
