import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/api/client'
import type { ContactsResponse } from '@/api/types'
import { engagementKeys } from './useEngagements'

export const contactKeys = {
  list: (engagementId: string) => ['contacts', engagementId] as const,
}

/** Choose contact: the scenario's contacts and how many emails each has had this round. */
export function useContacts(engagementId: string) {
  return useQuery({
    queryKey: contactKeys.list(engagementId),
    queryFn: async () => {
      const res = await apiClient.get<ContactsResponse>(`/api/v1/engagements/${engagementId}/contacts`)
      return res.data
    },
    enabled: Boolean(engagementId),
  })
}

/** Choose (or change) who the learner emails. */
export function useChooseContact(engagementId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (personaId: string) => {
      const res = await apiClient.post<ContactsResponse>(
        `/api/v1/engagements/${engagementId}/contacts/choice`,
        { personaId },
      )
      return res.data
    },
    onSuccess: (contacts) => {
      qc.setQueryData(contactKeys.list(engagementId), contacts)
      void qc.invalidateQueries({ queryKey: engagementKeys.all })
    },
  })
}
