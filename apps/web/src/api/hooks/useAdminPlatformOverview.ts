import { useQuery } from '@tanstack/react-query'
import apiClient from '@/api/client'
import type { PlatformOverview } from '@/api/types'

export const adminPlatformKeys = {
  overview: ['admin', 'platform', 'overview'] as const,
}

export function useAdminPlatformOverview(enabled: boolean) {
  return useQuery({
    queryKey: adminPlatformKeys.overview,
    enabled,
    queryFn: async ({ signal }) => (await apiClient.get<PlatformOverview>('/api/v1/admin/platform/overview', { signal })).data,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
  })
}
