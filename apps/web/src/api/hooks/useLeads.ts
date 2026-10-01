import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/api/client'
import type { LeadIntelligence, ResearchArtifact, ResearchEvidence, ResearchGateStatus, ResearchSourceDeck, SaveResearchPayload } from '@/api/types'

// "Choose a lead" was removed: each scenario has one company profile, opened
// when the engagement starts. The lead catalogue, list and selection hooks are gone.

const RESEARCH_SOURCE_DECK_STALE_TIME = 10 * 60_000

export function useResearch(engagementId: string) {
  return useQuery({
    queryKey: ['research', engagementId],
    queryFn: async () => {
      const res = await apiClient.get<ResearchEvidence[]>(
        `/api/v1/engagements/${engagementId}/research`
      )
      return res.data
    },
    enabled: Boolean(engagementId),
  })
}

export function useSaveResearch(engagementId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: SaveResearchPayload) => {
      const res = await apiClient.post<ResearchEvidence>(
        `/api/v1/engagements/${engagementId}/research`,
        data
      )
      return res.data
    },
    onSuccess: (savedEvidence) => {
      // The POST response is the authoritative newly-created row. Put it into
      // the active query immediately, then revalidate related server-derived
      // views in the background. This keeps the gate responsive without a
      // page refresh while preserving the backend as the source of truth.
      qc.setQueryData<ResearchEvidence[]>(['research', engagementId], (current = []) => {
        const withoutSavedRow = current.filter((item) => item.id !== savedEvidence.id)
        return [...withoutSavedRow, savedEvidence]
      })

      void qc.invalidateQueries({ queryKey: ['research', engagementId] })
      void qc.invalidateQueries({ queryKey: ['lead-intelligence', engagementId] })
      void qc.invalidateQueries({ queryKey: ['research-gate', engagementId] })
    },
  })
}

/** Immutable scenario-authored source deck. The API fans out lanes concurrently. */
export function useResearchSourceDeck(engagementId: string) {
  return useQuery({
    queryKey: ['research-source-deck', engagementId],
    queryFn: async () => {
      const res = await apiClient.get<ResearchSourceDeck>(`/api/v1/engagements/${engagementId}/research-source-deck`)
      return res.data
    },
    enabled: Boolean(engagementId),
    staleTime: RESEARCH_SOURCE_DECK_STALE_TIME,
    gcTime: 30 * 60_000,
    refetchInterval: (query) => query.state.data?.enrichmentPending ? 2_000 : false,
    refetchOnWindowFocus: false,
    retry: 1,
  })
}

export function useAnalyzeUserContext(engagementId: string) {
  return useMutation({
    mutationFn: async (context: string) => {
      const res = await apiClient.post<ResearchArtifact>(
        `/api/v1/engagements/${engagementId}/research-intelligence/user-context`,
        { context }
      )
      return res.data
    },
  })
}

/** Powers the Client Intelligence "Client Profile" panel — hidden fields revealed
 *  progressively as research evidence accumulates. */
export function useLeadIntelligence(engagementId: string) {
  return useQuery({
    queryKey: ['lead-intelligence', engagementId],
    queryFn: async () => {
      const res = await apiClient.get<LeadIntelligence>(
        `/api/v1/engagements/${engagementId}/lead-intelligence`
      )
      return res.data
    },
    enabled: Boolean(engagementId),
  })
}

/** The "Proceed to Outreach" requirements checklist — polled so the gate UI
 *  stays in sync as the learner adds evidence. */
export function useResearchGateStatus(engagementId: string) {
  return useQuery({
    queryKey: ['research-gate', engagementId],
    queryFn: async () => {
      const res = await apiClient.get<ResearchGateStatus>(
        `/api/v1/engagements/${engagementId}/research-readiness`
      )
      return res.data
    },
    enabled: Boolean(engagementId),
  })
}

/** Advances the engagement CLIENT_INTELLIGENCE -> HYPOTHESIS_READY once the gate
 *  conditions are met, unlocking Outreach. Rejected with 422 (surfaced via
 *  mutation.error) if the learner hasn't satisfied the requirements yet. */
export function useCompleteResearch(engagementId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<ResearchGateStatus>(
        `/api/v1/engagements/${engagementId}/research/complete`
      )
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['research-gate', engagementId] })
      qc.invalidateQueries({ queryKey: ['engagements', engagementId] })
    },
  })
}
