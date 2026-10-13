import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/api/client'
import type { AchievementAdminView, AchievementPreview, ConditionNode, UpsertAchievementRequest } from '@/api/types'

const adminAchievementKeys = {
  all: ['admin', 'achievements'] as const,
}

export function useAdminAchievements() {
  return useQuery({
    queryKey: adminAchievementKeys.all,
    queryFn: async () => {
      const res = await apiClient.get<AchievementAdminView[]>('/api/v1/admin/achievements')
      return res.data
    },
  })
}

export function useCreateAchievement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (request: UpsertAchievementRequest) => {
      const res = await apiClient.post<AchievementAdminView>('/api/v1/admin/achievements', request)
      return res.data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminAchievementKeys.all }),
  })
}

export function useUpdateAchievement(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (request: UpsertAchievementRequest) => {
      const res = await apiClient.put<AchievementAdminView>(`/api/v1/admin/achievements/${id}`, request)
      return res.data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminAchievementKeys.all }),
  })
}

export function useSetAchievementActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const res = await apiClient.patch<AchievementAdminView>(
        `/api/v1/admin/achievements/${id}/${active ? 'activate' : 'deactivate'}`,
      )
      return res.data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminAchievementKeys.all }),
  })
}

/**
 * Who would earn a draft badge now. Pass {@code draft} as null to skip (e.g. while
 * the rule is incomplete). {@code achievementId} counts current holders when editing.
 */
export function useAchievementPreview(
  draft: { rule: ConditionNode; scenarioId: string | null } | null,
  achievementId?: string,
) {
  return useQuery({
    queryKey: [...adminAchievementKeys.all, 'preview', achievementId ?? null, draft],
    queryFn: async () => {
      const res = await apiClient.post<AchievementPreview>('/api/v1/admin/achievements/preview', draft,
        { params: achievementId ? { achievementId } : undefined })
      return res.data
    },
    enabled: draft !== null,
    staleTime: 30_000,
    retry: false,
  })
}
