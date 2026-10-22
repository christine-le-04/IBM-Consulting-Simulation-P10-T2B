import { Link, useParams } from 'react-router-dom'
import { Button, InlineLoading, InlineNotification } from '@carbon/react'
import { useQuery } from '@tanstack/react-query'
import apiClient from '@/api/client'
import type { ScenarioSummary } from '@/api/types'
import { useAuthStore } from '@/store/authStore'
import styles from './ScenarioAnnouncementPage.module.css'

export default function ScenarioAnnouncementPage() {
  const { scenarioId } = useParams()
  const userId = useAuthStore((state) => state.userId)
  // Check access afresh: a saved announcement does not grant access to the scenario.
  const scenario = useQuery({
    queryKey: ['announcement-scenario', userId, scenarioId],
    queryFn: async ({ signal }) => (await apiClient.get<ScenarioSummary>(`/api/v1/scenarios/${scenarioId}`, { signal })).data,
    enabled: Boolean(userId && scenarioId), retry: false, staleTime: 0,
  })
  return <main className={styles.page}>
    <h1>{scenario.data?.title ?? 'Scenario'}</h1>
    {scenario.isLoading && <InlineLoading description="Checking scenario availability" />}
    {scenario.isError && <section className={styles.unavailable}>
      <InlineNotification kind="info" title="Scenario unavailable"
        subtitle="It may have been archived or removed, or you may no longer have access. Your existing runs are available in your Office." hideCloseButton />
      <div className={styles.actions}>
        <Button kind="tertiary" size="sm" onClick={() => void scenario.refetch()}>Try again</Button>
        <Link to="/dashboard">Open your Office</Link>
      </div>
    </section>}
    {scenario.data && <section className={styles.scenarioInfo}>
      <p>{scenario.data.description}</p>
      {scenario.data.status === 'ARCHIVED' ? <p>This scenario has been archived. You can continue existing runs in your Office.</p>
        : <p>Open your Office to start or continue an engagement with this scenario.</p>}
      <Link to="/dashboard">Open your Office</Link>
    </section>}
  </main>
}
