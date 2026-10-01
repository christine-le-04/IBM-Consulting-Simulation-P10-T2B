import type { ReactNode } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useEngagement } from '@/api/hooks/useEngagements'
import { isBackFromFailedOutreach } from '@/lifecycle/contactSelection'

/**
 * Make contact needs a contact. Without one, send the learner to Choose contact,
 * or back to research if every contact has just failed.
 */
export default function RequireContact({ children }: { children: ReactNode }) {
  const { engagementId } = useParams<{ engagementId: string }>()
  const { data: engagement, isLoading } = useEngagement(engagementId!)
  if (isLoading) return null

  const choosing = engagement?.state === 'HYPOTHESIS_READY' || engagement?.state === 'OUTREACHING'
  if (engagement && choosing && !engagement.contactPersonaId) {
    const to = isBackFromFailedOutreach(engagement) ? 'intelligence' : 'contact'
    return <Navigate to={`/dashboard/engagements/${engagementId}/${to}`} replace />
  }
  return <>{children}</>
}
