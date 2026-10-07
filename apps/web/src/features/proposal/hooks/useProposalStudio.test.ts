import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useProposalStudio } from './useProposalStudio'

const resetSubmit = vi.fn()

vi.mock('@/api/hooks/useProposal', () => {
  const mutation = () => ({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue(undefined), reset: vi.fn(), isPending: false, isError: false })
  return {
    useProposalWorkspace: () => ({ data: { sources: [], proposal: undefined }, refetch: vi.fn() }),
    useSaveProposalDraft: mutation,
    useProposalReview: mutation,
    useProposalChallenge: mutation,
    useReviseProposal: mutation,
    useSubmitProposal: () => ({ ...mutation(), reset: resetSubmit, isError: true }),
  }
})

describe('useProposalStudio', () => {
  it('clears a rejected submit once the learner edits the draft', () => {
    const { result } = renderHook(() => useProposalStudio('eng-1'))
    resetSubmit.mockClear()

    act(() => result.current.updateDraft((current) => ({ ...current, problemStatement: 'Claims backlog doubled since March' })))

    expect(resetSubmit).toHaveBeenCalledTimes(1)
  })
})
