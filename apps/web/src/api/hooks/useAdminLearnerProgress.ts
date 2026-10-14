import { useQuery } from '@tanstack/react-query'
import apiClient from '@/api/client'
import type { LearnerProgressEntry } from '@/api/types'

export const adminLearnerKeys = {
  progress: ['admin', 'learners', 'progress'] as const,
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
