import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/api/client'
import type { AnnouncementRole } from './useAnnouncements'

export interface SentAnnouncement {
  id: string
  title: string
  message: string
  audience: 'ALL' | 'ROLES'
  targetRoles: AnnouncementRole[]
  createdAt: string
  withdrawnAt: string | null
  status: 'PUBLISHED' | 'WITHDRAWN' | 'SCHEDULED' | 'EXPIRED'
  publishAt?: string
  expiresAt?: string | null
}
export interface SentAnnouncementsPage { items: SentAnnouncement[]; totalElements: number; page: number; size: number }
export const recipientRoles: { value: AnnouncementRole; label: string }[] = [
  { value: 'LEARNER', label: 'Learners' }, { value: 'SCENARIO_AUTHOR', label: 'Scenario authors' },
  { value: 'REVIEWER', label: 'Reviewers' }, { value: 'ADMINISTRATOR', label: 'Administrators' },
]
export const audienceLabel = (audience: string, roles: AnnouncementRole[]) => audience === 'ALL'
  ? 'All users' : recipientRoles.filter((role) => roles.includes(role.value)).map((role) => role.label).join(', ')

export function useAdminAnnouncements(page: number) {
  return useQuery({
    queryKey: ['admin', 'announcements', page],
    queryFn: async ({ signal }) => (await apiClient.get<SentAnnouncementsPage>('/api/v1/admin/announcements', { params: { page, size: 20 }, signal })).data,
    refetchInterval: 60_000,
  })
}
export function useWithdrawAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/api/v1/admin/announcements/${id}/withdraw`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['announcements'] })
      void qc.invalidateQueries({ queryKey: ['admin', 'announcements'] })
      void qc.invalidateQueries({ queryKey: ['admin', 'audit-events'] })
    },
  })
}
