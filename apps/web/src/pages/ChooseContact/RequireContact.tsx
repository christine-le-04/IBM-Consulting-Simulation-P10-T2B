import type { ReactNode } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { useChosenContact } from '@/store/contactSelectionStore'

/** Make contact needs a contact. Without one, send the learner to Choose contact. */
export default function RequireContact({ children }: { children: ReactNode }) {
  const { engagementId } = useParams<{ engagementId: string }>()
  const choice = useChosenContact(engagementId!)
  if (!choice) return <Navigate to={`/dashboard/engagements/${engagementId}/contact`} replace />
  return <>{children}</>
}
