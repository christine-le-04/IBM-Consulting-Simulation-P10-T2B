import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/api/client'
import { isAxiosError } from 'axios'
import type { CapabilityBrief, OutreachAttempt } from '@/api/types'

const OUTREACH_REQUEST_TIMEOUT_MS = 20_000

export function useOutreach(engagementId: string) {
  return useQuery({
    queryKey: ['outreach', engagementId],
    queryFn: async () => {
      const res = await apiClient.get<OutreachAttempt[]>(
        `/api/v1/engagements/${engagementId}/outreach`
      )
      return res.data
    },
    enabled: Boolean(engagementId),
  })
}

export function useSendOutreach(engagementId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { subject: string; body: string }) => {
      const request = { ...data, requestId: crypto.randomUUID() }
      for (let attempt = 0; ; attempt++) {
        try {
          const res = await apiClient.post<OutreachAttempt>(
            `/api/v1/engagements/${engagementId}/outreach`, request,
            { timeout: OUTREACH_REQUEST_TIMEOUT_MS },
          )
          return res.data
        } catch (error) {
          if (attempt > 0 || !isAxiosError(error) || error.response?.status !== 503) throw error
          // A provider failure consumes no attempt. Reuse the key so recovery cannot duplicate an email.
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      }
    },
    onSuccess: (attempt) => {
      qc.setQueryData<OutreachAttempt[]>(['outreach', engagementId], (current = []) => [
        ...current.filter((item) => item.id !== attempt.id),
        attempt,
      ])
      void qc.invalidateQueries({ queryKey: ['outreach', engagementId] })
      void qc.invalidateQueries({ queryKey: ['engagements', engagementId] })
      // Emails left per contact, and a possible new round, come from the backend.
      void qc.invalidateQueries({ queryKey: ['contacts', engagementId] })
      void qc.invalidateQueries({ queryKey: ['engagements'] })
    },
  })
}

export function useCapabilityBrief(engagementId: string) {
  return useQuery({
    queryKey: ['capability-brief', engagementId],
    queryFn: async () => {
      const res = await apiClient.get<CapabilityBrief | null>(
        `/api/v1/engagements/${engagementId}/outreach/capability-brief`
      )
      return res.data
    },
    enabled: Boolean(engagementId),
  })
}

export function useSubmitCapabilityBrief(engagementId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Pick<CapabilityBrief, 'relevantExperience' | 'approach' | 'caseExample' | 'clientFit'>) => {
      const res = await apiClient.post<CapabilityBrief>(
        `/api/v1/engagements/${engagementId}/outreach/capability-brief`, data,
        { timeout: OUTREACH_REQUEST_TIMEOUT_MS }
      )
      return res.data
    },
    onSuccess: (brief) => {
      qc.setQueryData(['capability-brief', engagementId], brief)
      void qc.invalidateQueries({ queryKey: ['engagements', engagementId] })
    },
  })
}
