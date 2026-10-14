import { keepPreviousData, useQuery } from '@tanstack/react-query'
import apiClient from '@/api/client'

export interface AdminAuditEvent {
  id: string
  occurredAt: string
  actorId: string | null
  actorDisplayName: string | null
  actorEmail: string | null
  actorRole: string | null
  action: string
  targetType: string
  targetId: string
  details: string | null
}

export interface AdminAuditPage {
  items: AdminAuditEvent[]
  totalElements: number
  page: number
  size: number
  totalPages: number
  actions: string[]
}

export interface AdminAuditFilters {
  search?: string
  action?: string
  targetType?: string
  from?: string
  to?: string
  page: number
  size: number
}

export function useAdminAuditEvents(filters: AdminAuditFilters) {
  return useQuery({
    queryKey: ['admin', 'audit-events', filters],
    queryFn: async ({ signal }) => (await apiClient.get<AdminAuditPage>('/api/v1/admin/audit-events', {
      params: filters, signal,
    })).data,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    refetchOnMount: 'always',
  })
}
