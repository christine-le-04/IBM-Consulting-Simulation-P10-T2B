import { keepPreviousData, useQuery } from '@tanstack/react-query'
import apiClient from '@/api/client'
import type { Assessment, LearnerProgressEntry } from '@/api/types'
import type { LearnerStage, LearnerStatus } from '@/features/admin/learnerProgress'

export interface LearnerProgressFilters {
  page: number
  size: number
  search?: string
  scenarioId?: string
  stage?: LearnerStage
  status?: LearnerStatus
}

export interface LearnerProgressPage {
  items: LearnerProgressEntry[]
  totalElements: number
  page: number
  size: number
  totalPages: number
  asOf: string
  summary: { inProgress: number; stuck: number; completed: number; meetingFailed: number; averageScore: number | null; totalRuns: number }
  scenarios: { id: string; title: string }[]
}

export const adminLearnerKeys = {
  progress: ['admin', 'learners', 'progress'] as const,
  run: (engagementId: string) => ['admin', 'learners', 'run', engagementId] as const,
  assessment: (engagementId: string) => ['admin', 'learners', 'assessment', engagementId] as const,
}

export function useAdminLearnerProgress(filters: LearnerProgressFilters, enabled = true) {
  return useQuery({
    queryKey: [...adminLearnerKeys.progress, filters],
    enabled,
    queryFn: async ({ signal }) => (await apiClient.get<LearnerProgressPage>('/api/v1/admin/learners/progress', { params: filters, signal })).data,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  })
}

export function useAdminLearnerRun(engagementId: string) {
  return useQuery({
    queryKey: adminLearnerKeys.run(engagementId),
    enabled: Boolean(engagementId),
    queryFn: async ({ signal }) => (await apiClient.get<LearnerProgressEntry | null>(`/api/v1/admin/learners/${engagementId}`, { signal })).data,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  })
}

/** Read-only view of any learner's assessment; never generates one on the learner's behalf. */
export function useAdminRunAssessment(engagementId: string, enabled: boolean) {
  return useQuery({
    queryKey: adminLearnerKeys.assessment(engagementId),
    enabled: enabled && Boolean(engagementId),
    queryFn: async ({ signal }) => (await apiClient.get<Assessment>(`/api/v1/admin/engagements/${engagementId}/assessment`, { signal })).data,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}
