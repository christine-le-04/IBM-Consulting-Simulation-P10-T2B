import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Client } from '@stomp/stompjs'
import apiClient from '@/api/client'
import { ensureFreshAccessToken } from '@/api/refreshSession'
import { toWebSocketUrl } from '@/api/hooks/useMeetingSocket'
import { useAuthStore } from '@/store/authStore'

export interface Announcement {
  id: string
  scenarioId: string
  kind: 'SCENARIO_PUBLISHED' | 'SCENARIO_ARCHIVED'
  scenarioTitle: string
  createdAt: string
  read: boolean
}
export interface AnnouncementFeed {
  items: Announcement[]
  totalElements: number
  unreadCount: number
  page: number
  size: number
}

export function useAnnouncements(page: number) {
  const userId = useAuthStore((state) => state.userId)
  return useQuery({
    queryKey: ['announcements', userId, page],
    queryFn: async ({ signal }) => (await apiClient.get<AnnouncementFeed>('/api/v1/announcements', {
      params: { page, size: 20 }, signal,
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
