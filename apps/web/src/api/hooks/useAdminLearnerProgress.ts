import { useQuery } from '@tanstack/react-query'
import apiClient from '@/api/client'
import type { Assessment, CohortAnalyticsResponse, LearnerProgressEntry } from '@/api/types'

export const adminLearnerKeys = {
  progress: ['admin', 'learners', 'progress'] as const,
  cohorts: ['admin', 'learners', 'cohorts'] as const,
  assessment: (engagementId: string) => ['admin', 'learners', 'assessment', engagementId] as const,
}

export function useAdminLearnerProgress(enabled: boolean) {
  return useQuery({
    queryKey: adminLearnerKeys.progress,
    enabled,
    queryFn: async () => (await apiClient.get<LearnerProgressEntry[]>('/api/v1/admin/learners/progress')).data,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  })
}

export function useAdminCohortAnalytics(enabled: boolean) {
  return useQuery({
    queryKey: adminLearnerKeys.cohorts,
    enabled,
    queryFn: async () => (await apiClient.get<CohortAnalyticsResponse>('/api/v1/admin/learners/cohorts')).data,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}

/** Read-only view of any learner's assessment; never generates one on the learner's behalf. */
export function useAdminRunAssessment(engagementId: string, enabled: boolean) {
  return useQuery({
    queryKey: adminLearnerKeys.assessment(engagementId),
    enabled: enabled && Boolean(engagementId),
    queryFn: async () => (await apiClient.get<Assessment>(`/api/v1/admin/engagements/${engagementId}/assessment`)).data,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}
