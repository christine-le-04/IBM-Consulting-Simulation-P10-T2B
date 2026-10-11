import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import apiClient from '@/api/client'
import type { ScenarioCatalogPage, ScenarioSummary } from '@/api/types'
import { useAuthStore } from '@/store/authStore'

const SCENARIO_STALE_TIME = 10 * 60_000

export interface ScenarioCatalogFilters {
  search?: string
  industry?: string
  difficulty?: number
  page: number
  size: number
}

async function fetchScenarioCatalog(filters: ScenarioCatalogFilters) {
  const response = await apiClient.get<ScenarioCatalogPage>('/api/v1/scenarios/catalog', { params: filters })
  return response.data
}

export function useScenarioCatalog(filters: ScenarioCatalogFilters) {
  const userId = useAuthStore((state) => state.userId)
  const queryClient = useQueryClient()
  const queryKey = ['scenario-catalog', userId, filters] as const
  const query = useQuery({
    queryKey,
    queryFn: () => fetchScenarioCatalog(filters),
    placeholderData: (previous, previousQuery) => previousQuery?.queryKey[1] === userId ? previous : undefined,
    staleTime: 60_000,
    refetchInterval: (current) => current.state.data?.totalElements === 0 ? 10_000 : false,
  })

  useEffect(() => {
    if (!query.data || filters.page + 1 >= query.data.totalPages) return
    const nextFilters = { ...filters, page: filters.page + 1 }
    void queryClient.prefetchQuery({
      queryKey: ['scenario-catalog', userId, nextFilters],
      queryFn: () => fetchScenarioCatalog(nextFilters),
      staleTime: 60_000,
    })
  }, [filters, query.data, queryClient, userId])

  return query
}

export function useScenarioCatalogIndustries() {
  const userId = useAuthStore((state) => state.userId)
  return useQuery({
    queryKey: ['scenario-catalog', userId, 'industries'],
    queryFn: async () => (await apiClient.get<string[]>('/api/v1/scenarios/catalog/industries')).data,
    staleTime: 10 * 60_000,
    refetchInterval: (current) => current.state.data?.length === 0 ? 10_000 : false,
  })
}

export function useScenarios() {
  return useQuery({
    queryKey: ['scenarios'],
    queryFn: async () => {
      const res = await apiClient.get<ScenarioSummary[]>('/api/v1/scenarios')
      return res.data
    },
  })
}

export function useScenario(id: string) {
  return useQuery({
    queryKey: ['scenarios', id],
    queryFn: async () => {
      const res = await apiClient.get<ScenarioSummary>(`/api/v1/scenarios/${id}`)
      return res.data
    },
    enabled: Boolean(id),
    staleTime: SCENARIO_STALE_TIME,
    refetchOnWindowFocus: false,
  })
}
