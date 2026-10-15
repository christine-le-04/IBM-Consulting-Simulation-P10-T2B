import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Client } from '@stomp/stompjs'
import apiClient from '@/api/client'
import { ensureFreshAccessToken } from '@/api/refreshSession'
import { toWebSocketUrl } from '@/api/hooks/useMeetingSocket'
import { useAuthStore } from '@/store/authStore'

export interface Announcement {
  id: string
  scenarioId: string | null
  kind: 'SCENARIO_PUBLISHED' | 'SCENARIO_ARCHIVED' | 'ADMIN_MESSAGE' | 'SCENARIO_ASSIGNED'
  scenarioTitle: string | null
  title?: string
  message?: string
  createdAt: string
  read: boolean
}
export type AnnouncementRole = 'LEARNER' | 'SCENARIO_AUTHOR' | 'REVIEWER' | 'ADMINISTRATOR'
export interface AnnouncementFeed {
  items: Announcement[]
  totalElements: number
  unreadCount: number
  page: number
  size: number
  readThrough?: string
}

// Fallbacks support scenario announcements returned by an API during a rolling deployment.
export const announcementTitle = (item: Announcement) => item.title ?? item.scenarioTitle ?? 'Announcement'
export const announcementMessage = (item: Announcement) => item.message ?? (item.kind === 'SCENARIO_PUBLISHED'
  ? 'A scenario is now available in the catalogue.'
  : item.kind === 'SCENARIO_ARCHIVED' ? 'This scenario is no longer available for new runs. Existing runs are kept.' : '')

export function usePublishAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { title: string; message: string; targetRoles?: AnnouncementRole[]; publishAt?: string; expiresAt?: string }) =>
      (await apiClient.post<{ id: string }>('/api/v1/admin/announcements', input)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['announcements'] })
      void qc.invalidateQueries({ queryKey: ['admin', 'announcements'] })
      void qc.invalidateQueries({ queryKey: ['admin', 'audit-events'] })
    },
  })
}

export function useAnnouncements(page: number, unreadOnly = false) {
  const userId = useAuthStore((state) => state.userId)
  return useQuery({
    queryKey: ['announcements', userId, page, unreadOnly],
    queryFn: async ({ signal }) => (await apiClient.get<AnnouncementFeed>('/api/v1/announcements', {
      params: { page, size: 20, unreadOnly }, signal,
    })).data,
    enabled: Boolean(userId),
    // Covers offline clients, missed socket events and API instances using separate in-memory brokers.
    refetchInterval: 60_000,
    staleTime: 15_000,
  })
}

export function useReadAnnouncements() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => apiClient.post('/api/v1/announcements/read', { ids }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['announcements'] }) },
  })
}

export function useMarkAllAnnouncementsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (through: string) => apiClient.post('/api/v1/announcements/read-all', { through }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['announcements'] }) },
  })
}

export function useAnnouncementUpdates() {
  const userId = useAuthStore((state) => state.userId)
  const sessionId = useAuthStore((state) => state.sessionId)
  const qc = useQueryClient()
  useEffect(() => {
    if (!userId) return
    let disposed = false
    const invalidate = () => { if (!disposed) void qc.invalidateQueries({ queryKey: ['announcements', userId] }) }
    const client = new Client({
      brokerURL: toWebSocketUrl(import.meta.env.VITE_API_BASE_URL ?? ''),
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
    })
    client.beforeConnect = async () => {
      try { await ensureFreshAccessToken() } catch { /* HTTP polling remains available while reconnecting. */ }
      const token = useAuthStore.getState().token
      if (disposed || !token) { void client.deactivate(); return }
      client.connectHeaders = { Authorization: `Bearer ${token}` }
    }
    client.onConnect = () => {
      if (disposed) return
      client.subscribe('/topic/announcements', invalidate)
      invalidate()
    }
    client.activate()
    return () => { disposed = true; void client.deactivate() }
  }, [userId, sessionId, qc])
}
