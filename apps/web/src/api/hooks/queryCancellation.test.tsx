import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CanceledError, type AxiosAdapter } from 'axios'
import type { ReactNode } from 'react'
import apiClient from '@/api/client'
import { useMyAchievements } from './useAchievements'
import { useAssessment } from './useAssessment'
import { useContacts } from './useContacts'
import { useMyEngagements, useEngagement } from './useEngagements'
import { useResearch, useResearchSourceDeck, useLeadIntelligence, useResearchGateStatus } from './useLeads'
import { useMeetingPreparation, useMeeting, useMeetingTranscript, usePersonaState, useMeetingResponseOptions } from './useMeeting'
import { useOutreach, useCapabilityBrief } from './useOutreach'
import { usePortfolioSummary, useReplayComparison } from './usePortfolio'
import { useProposal, useProposalWorkspace } from './useProposal'
import { useScenarios, useScenario, useScenarioCatalog, useScenarioCatalogIndustries } from './useScenarios'
import { useAdminAchievements, useAchievementPreview } from './useAdminAchievements'
import { useAdminAiOperations } from './useAdminAiOperations'
import { useAdminAnnouncements } from './useAdminAnnouncements'
import { useAdminAuditEvents } from './useAdminAuditEvents'
import { useAdminLearnerProgress, useAdminLearnerRun, useAdminRunAssessment } from './useAdminLearnerProgress'
import { useAdminPlatformOverview } from './useAdminPlatformOverview'
import { useAdminUsers } from './useAdminUsers'
import { useAdminScenarioCatalog, useAllScenariosForAdmin, useScenarioAuthoring, useScenarioAuthoringLeads, useGetKnowledgeDocuments, useScenarioAssignments } from './useAdminScenarios'

const originalAdapter = apiClient.defaults.adapter
const requests: { url: string | undefined; signal: AbortSignal; params: unknown }[] = []
const clients: QueryClient[] = []

// Exercise the real Axios client and its combined session/query signals without
// sending network requests. The pending transport must actually be aborted.
const pendingAdapter: AxiosAdapter = (config) => new Promise((_, reject) => {
  const signal = config.signal as AbortSignal
  requests.push({ url: config.url, signal, params: config.params })
  if (signal.aborted) reject(new CanceledError())
  else signal.addEventListener('abort', () => reject(new CanceledError()), { once: true })
})

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(client)
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return { client, wrapper }
}

beforeEach(() => {
  requests.length = 0
  apiClient.defaults.adapter = pendingAdapter
})

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  apiClient.defaults.adapter = originalAdapter
})

const reads = [
  ['achievements', function useRead() { return useMyAchievements() }],
  ['assessment', function useRead() { return useAssessment('eng-1') }],
  ['contacts', function useRead() { return useContacts('eng-1') }],
  ['engagements', function useRead() { return useMyEngagements() }],
  ['engagement', function useRead() { return useEngagement('eng-1') }],
  ['research', function useRead() { return useResearch('eng-1') }],
  ['source deck', function useRead() { return useResearchSourceDeck('eng-1') }],
  ['intelligence', function useRead() { return useLeadIntelligence('eng-1') }],
  ['research gate', function useRead() { return useResearchGateStatus('eng-1') }],
  ['preparation', function useRead() { return useMeetingPreparation('eng-1') }],
  ['meeting', function useRead() { return useMeeting('meeting-1') }],
  ['transcript', function useRead() { return useMeetingTranscript('meeting-1') }],
  ['persona state', function useRead() { return usePersonaState('meeting-1') }],
  ['response options', function useRead() { return useMeetingResponseOptions('meeting-1') }],
  ['outreach', function useRead() { return useOutreach('eng-1') }],
  ['capability brief', function useRead() { return useCapabilityBrief('eng-1') }],
  ['portfolio', function useRead() { return usePortfolioSummary() }],
  ['replay comparison', function useRead() { return useReplayComparison('eng-1', 'eng-2') }],
  ['proposal', function useRead() { return useProposal('eng-1') }],
  ['proposal workspace', function useRead() { return useProposalWorkspace('eng-1') }],
  ['scenarios', function useRead() { return useScenarios() }],
  ['scenario', function useRead() { return useScenario('scenario-1') }],
  ['catalogue', function useRead() { return useScenarioCatalog({ page: 0, size: 8 }) }],
  ['industries', function useRead() { return useScenarioCatalogIndustries() }],
  ['admin achievements', function useRead() { return useAdminAchievements() }],
  ['achievement preview', function useRead() { return useAchievementPreview({
    rule: { kind: 'GROUP', operator: 'AND', children: [], type: null, competencyName: null, threshold: null },
    scenarioId: null,
  }) }],
  ['AI operations', function useRead() { return useAdminAiOperations() }],
  ['sent announcements', function useRead() { return useAdminAnnouncements(0) }],
  ['audit events', function useRead() { return useAdminAuditEvents({ page: 0, size: 20 }) }],
  ['learner progress', function useRead() { return useAdminLearnerProgress({ page: 0, size: 25 }) }],
  ['learner run', function useRead() { return useAdminLearnerRun('eng-1') }],
  ['admin assessment', function useRead() { return useAdminRunAssessment('eng-1', true) }],
  ['platform overview', function useRead() { return useAdminPlatformOverview(true) }],
  ['user directory', function useRead() { return useAdminUsers({ page: 0, size: 20 }) }],
  ['admin catalogue', function useRead() { return useAdminScenarioCatalog({ page: 0, size: 8 }) }],
  ['admin scenarios', function useRead() { return useAllScenariosForAdmin() }],
  ['scenario authoring', function useRead() { return useScenarioAuthoring('scenario-1') }],
  ['scenario leads', function useRead() { return useScenarioAuthoringLeads('scenario-1') }],
  ['knowledge documents', function useRead() { return useGetKnowledgeDocuments('scenario-1') }],
  ['scenario assignments', function useRead() { return useScenarioAssignments('scenario-1') }],
] as const

describe('query cancellation', () => {
  it.each(reads)('aborts the %s transport when its last consumer leaves', async (_, useRead) => {
    const { client, wrapper } = setup()
    const { unmount } = renderHook(() => useRead(), { wrapper })
    await waitFor(() => expect(requests).toHaveLength(1))
    expect(requests[0].signal.aborted).toBe(false)

    unmount()

    expect(requests[0].signal.aborted).toBe(true)
    expect(client.getQueryCache().getAll()[0].state.fetchStatus).toBe('idle')
    expect(client.getQueryCache().getAll()[0].state.error).toBeNull()
  })

  it('aborts the previous engagement request when the route changes', async () => {
    const { wrapper } = setup()
    const { rerender } = renderHook(({ id }) => useContacts(id), {
      wrapper, initialProps: { id: 'eng-1' },
    })
    await waitFor(() => expect(requests).toHaveLength(1))
    rerender({ id: 'eng-2' })
    await waitFor(() => expect(requests).toHaveLength(2))
    expect(requests[0].signal.aborted).toBe(true)
    expect(requests[1].signal.aborted).toBe(false)
    expect(requests[1].url).toBe('/api/v1/engagements/eng-2/contacts')
  })

  it('cancels an obsolete learner page and forwards all server filters', async () => {
    const { wrapper } = setup()
    const { rerender } = renderHook(({ page }) => useAdminLearnerProgress({
      page, size: 25, search: 'Ana', scenarioId: 'scenario-1', stage: 'Meeting', status: 'STUCK',
    }), { wrapper, initialProps: { page: 0 } })
    await waitFor(() => expect(requests).toHaveLength(1))
    rerender({ page: 1 })
    await waitFor(() => expect(requests).toHaveLength(2))
    expect(requests[0].signal.aborted).toBe(true)
    expect(requests[1].signal.aborted).toBe(false)
    expect(requests[1].params).toEqual({
      page: 1, size: 25, search: 'Ana', scenarioId: 'scenario-1', stage: 'Meeting', status: 'STUCK',
    })
  })

  it('keeps a shared request alive until every consumer leaves', async () => {
    const { wrapper } = setup()
    const first = renderHook(() => useContacts('eng-1'), { wrapper })
    const second = renderHook(() => useContacts('eng-1'), { wrapper })
    await waitFor(() => expect(requests).toHaveLength(1))
    first.unmount()
    expect(requests[0].signal.aborted).toBe(false)
    second.unmount()
    expect(requests[0].signal.aborted).toBe(true)
  })

  it('cancels an obsolete catalogue search while retaining the new filters', async () => {
    const { wrapper } = setup()
    const { rerender } = renderHook(({ search }) => useScenarioCatalog({ page: 0, size: 8, search }), {
      wrapper, initialProps: { search: 'health' },
    })
    await waitFor(() => expect(requests).toHaveLength(1))
    rerender({ search: 'retail' })
    await waitFor(() => expect(requests).toHaveLength(2))
    expect(requests[0].signal.aborted).toBe(true)
    expect(requests[1].signal.aborted).toBe(false)
    expect(requests[1].params).toEqual({ page: 0, size: 8, search: 'retail' })
  })

  const directories = [
    ['users', function useRead(search: string) { return useAdminUsers({ page: 0, size: 8, search }) }],
    ['scenarios', function useRead(search: string) { return useAdminScenarioCatalog({ page: 0, size: 8, search }) }],
  ] as const

  it.each(directories)('cancels obsolete admin %s searches without cancelling the new search', async (_, useRead) => {
    const { wrapper } = setup()
    const { rerender } = renderHook(({ search }) => useRead(search), {
      wrapper, initialProps: { search: 'old' },
    })
    await waitFor(() => expect(requests).toHaveLength(1))
    rerender({ search: 'new' })
    await waitFor(() => expect(requests).toHaveLength(2))
    expect(requests[0].signal.aborted).toBe(true)
    expect(requests[1].signal.aborted).toBe(false)
    expect(requests[1].params).toEqual({ page: 0, size: 8, search: 'new' })
  })

  it.each(directories)('forwards cancellation to prefetched admin %s pages', async (name, useRead) => {
    apiClient.defaults.adapter = (config) => config.params.page === 0
      ? Promise.resolve({ config, status: 200, statusText: 'OK', headers: {}, data: {
        items: [], totalElements: 16, totalPages: 2, page: 0, size: 8,
      } })
      : pendingAdapter(config)
    const { client, wrapper } = setup()
    renderHook(() => useRead('search'), { wrapper })
    await waitFor(() => expect(requests).toHaveLength(1))
    expect(requests[0].params).toEqual({ page: 1, size: 8, search: 'search' })
    expect(requests[0].signal.aborted).toBe(false)
    await act(async () => { await client.cancelQueries({ queryKey: ['admin', name] }) })
    expect(requests[0].signal.aborted).toBe(true)
  })
})
