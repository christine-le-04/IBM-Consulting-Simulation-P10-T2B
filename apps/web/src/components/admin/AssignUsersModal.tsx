import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Button, Checkbox, InlineLoading, InlineNotification, Modal, Search, Tag } from '@carbon/react'
import styles from '@/pages/Admin/ScenarioBuilderPage.module.css'
import { useAdminUsers } from '@/api/hooks/useAdminUsers'
import { useScenarioAssignments, useUpdateScenarioAssignments } from '@/api/hooks/useAdminScenarios'
import type { ScenarioSummary } from '@/api/types'

/** The directory endpoint's largest page; larger cohorts are narrowed with search. */
const LEARNER_PAGE_SIZE = 100

/**
 * "Assign users" from the scenario list: pick the consultants assigned
 * this scenario. All learners can browse and start Live scenarios. Saving returns to the scenario list.
 */
export default function AssignUsersModal({ scenario, onClose, onSaved }: {
  scenario: ScenarioSummary
  onClose: () => void
  onSaved: (assignedCount: number) => void
}) {
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [selected, setSelected] = useState<Set<string> | null>(null)

  const assignments = useScenarioAssignments(scenario.id)
  const learners = useAdminUsers({
    role: 'LEARNER',
    search: deferredSearch.trim() || undefined,
    page: 0,
    size: LEARNER_PAGE_SIZE,
  })
  const save = useUpdateScenarioAssignments(scenario.id)

  // Start from the saved assignments once they load.
  useEffect(() => {
    if (assignments.data && selected === null) {
      setSelected(new Set(assignments.data.assignees.map((assignee) => assignee.id)))
    }
  }, [assignments.data, selected])

  const shown = useMemo(() => learners.data?.items ?? [], [learners.data])
  const totalMatches = learners.data?.totalElements ?? 0
  const allShownSelected = shown.length > 0 && shown.every((user) => selected?.has(user.id))

  const toggle = (userId: string, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current ?? [])
      if (checked) next.add(userId)
      else next.delete(userId)
      return next
    })
  }

  const toggleAllShown = () => {
    setSelected((current) => {
      const next = new Set(current ?? [])
      shown.forEach((user) => (allShownSelected ? next.delete(user.id) : next.add(user.id)))
      return next
    })
  }

  const submit = () => {
    if (!selected || save.isPending) return
    save.mutate([...selected], { onSuccess: (view) => onSaved(view.assignees.length) })
  }

  const loading = assignments.isLoading || selected === null

  return (
    <Modal
      open
      // No modalLabel: Carbon would use it as the dialog's accessible name instead of the heading.
      modalHeading="Assign users"
      primaryButtonText={save.isPending ? 'Saving...' : 'Save assignments'}
      secondaryButtonText="Cancel"
      primaryButtonDisabled={loading || save.isPending}
      onRequestClose={onClose}
      onRequestSubmit={submit}
      className={styles.createModal}
    >
      <div className={styles.assignBody}>
        <p className={styles.modalIntro}>
          Assign <strong>{scenario.title}</strong> to selected learners. All learners can still browse and start any live scenario.
          Assignments carry over to new revisions.
        </p>

        {assignments.isError ? (
          <InlineNotification kind="error" title="Could not load the current assignments" subtitle="Close this dialog and try again." hideCloseButton />
        ) : assignments.isLoading || selected === null ? (
          <InlineLoading description="Loading assignments..." />
        ) : (
          <>
            <Search
              id={`assign-search-${scenario.id}`}
              labelText="Search consultants"
              placeholder="Name or email"
              size="md"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <div className={styles.assignToolbar}>
              <span><strong>{selected.size}</strong> assigned</span>
              <Button kind="ghost" size="sm" onClick={toggleAllShown} disabled={shown.length === 0}>
                {allShownSelected ? 'Clear shown' : 'Select all shown'}
              </Button>
            </div>

            {learners.isError ? (
              <InlineNotification kind="error" title="Could not load consultants" subtitle="Check your connection and try again." hideCloseButton />
            ) : shown.length === 0 && !learners.isLoading ? (
              <p className={styles.assignEmpty}>
                {deferredSearch.trim() ? `No consultants match "${deferredSearch.trim()}".` : 'No consultant accounts exist yet. Create them in User management.'}
              </p>
            ) : (
              <fieldset className={styles.assignList} aria-busy={learners.isFetching}>
                <legend className={styles.visuallyHidden}>Consultants</legend>
                {shown.map((user) => (
                  <div key={user.id} className={styles.assignRow}>
                    <Checkbox
                      id={`assign-${scenario.id}-${user.id}`}
                      labelText={<span className={styles.assignName}>{user.displayName}<small>{user.email}</small></span>}
                      checked={selected.has(user.id)}
                      onChange={(_event, { checked }) => toggle(user.id, checked)}
                    />
                    {!user.active && <Tag type="gray" size="sm">Deactivated</Tag>}
                  </div>
                ))}
              </fieldset>
            )}
            {totalMatches > shown.length && (
              <p className={styles.assignHint}>
                Showing {shown.length} of {totalMatches} consultants. Search to find the rest; your selections are kept.
              </p>
            )}
          </>
        )}

        {save.isError && (
          <InlineNotification kind="error" title="Assignments were not saved" subtitle="Only consultant accounts can be assigned. Try again." hideCloseButton />
        )}
      </div>
    </Modal>
  )
}
