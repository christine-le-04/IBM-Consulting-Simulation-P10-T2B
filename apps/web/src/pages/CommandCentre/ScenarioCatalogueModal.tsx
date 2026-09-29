/**
 * The scenario catalogue — search, industry, difficulty and paging, as before —
 * moved off the Office page into the one place it is wanted: starting new work.
 */
import { useMemo, useState } from 'react'
import { Button, ComposedModal, Dropdown, ModalBody, ModalHeader, Pagination, Tag, TextInput } from '@carbon/react'
import { Add, Search } from '@carbon/icons-react'
import { useScenarioCatalog, useScenarioCatalogIndustries } from '@/api/hooks/useScenarios'
import type { ScenarioSummary } from '@/api/types'
import LoadingState from '@/components/shared/LoadingState'
import IndustryArt from '@/components/shell/IndustryArt'
import styles from './CommandCentrePage.module.scss'

const DIFFICULTY_ITEMS = ['All difficulty', 'Guided', 'Standard', 'Advanced']
const DIFFICULTY_VALUE: Record<string, number> = { Guided: 2, Standard: 3, Advanced: 4 }

export default function ScenarioCatalogueModal({
  firstVisit,
  isPending,
  onClose,
  onStart,
}: {
  firstVisit: boolean
  isPending: boolean
  onClose: () => void
  onStart: (scenario: ScenarioSummary) => void
}) {
  const [search, setSearch] = useState('')
  const [industry, setIndustry] = useState('')
  const [difficulty, setDifficulty] = useState<number | ''>('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(8)
  const filters = useMemo(() => ({
    search: search.trim() || undefined,
    industry: industry || undefined,
    difficulty: difficulty || undefined,
    page: page - 1,
    size: pageSize,
  }), [difficulty, industry, page, pageSize, search])
  const { data: catalogue, isFetching } = useScenarioCatalog(filters)
  const { data: industries = [] } = useScenarioCatalogIndustries()

  return (
    <ComposedModal open onClose={onClose} size="lg" aria-label="Scenario catalogue">
      <ModalHeader label="Scenario catalogue" title={firstVisit ? 'Other clients' : 'Find your next client'} buttonOnClick={onClose} />
      <ModalBody className={styles.catalogueBody}>
        <p className={styles.note}>
          {firstVisit
            ? 'Any of these works as a first engagement. They differ in industry and difficulty, not in what you have to do.'
            : `Explore ${catalogue?.totalElements.toLocaleString() ?? '...'} distinct, scenario-ready consulting engagements.`}
        </p>
        <div className={styles.catalogueControls}>
          <TextInput
            id="scenario-catalogue-search"
            labelText="Search scenarios"
            hideLabel
            placeholder="Search client, industry or opportunity"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1) }}
          />
          <Dropdown
            id="scenario-catalogue-industry"
            titleText="Industry"
            hideLabel
            label="All industries"
            items={['All industries', ...industries]}
            selectedItem={industry || 'All industries'}
            onChange={({ selectedItem }) => { setIndustry(selectedItem === 'All industries' ? '' : selectedItem ?? ''); setPage(1) }}
          />
          <Dropdown
            id="scenario-catalogue-difficulty"
            titleText="Difficulty"
            hideLabel
            label="All difficulty"
            items={DIFFICULTY_ITEMS}
            selectedItem={DIFFICULTY_ITEMS.find((item) => DIFFICULTY_VALUE[item] === difficulty) ?? 'All difficulty'}
            onChange={({ selectedItem }) => { setDifficulty(DIFFICULTY_VALUE[selectedItem ?? ''] ?? ''); setPage(1) }}
          />
        </div>

        {isFetching ? (
          <LoadingState />
        ) : catalogue?.items.length ? (
          <div className={styles.scenarioGrid}>
            {catalogue.items.map((scenario) => (
              <article key={scenario.id} className={styles.scenarioCard}>
                <IndustryArt industry={scenario.industry} size={56} />
                <div className={styles.scenarioTags}>
                  <Tag type="cyan" size="sm">{scenario.industry}</Tag>
                  <Tag type="gray" size="sm">Complexity: {scenario.difficulty}/5</Tag>
                </div>
                <h4>{scenario.title}</h4>
                <p>{scenario.description}</p>
                <Button renderIcon={Add} size="sm" disabled={isPending} onClick={() => onStart(scenario)}>Start Engagement</Button>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.empty}><Search size={20} /> No scenarios match these filters.</div>
        )}

        {catalogue && catalogue.totalElements > 0 && (
          <Pagination
            page={page}
            pageSize={pageSize}
            pageSizes={[8, 16, 24]}
            totalItems={catalogue.totalElements}
            onChange={({ page: next, pageSize: size }) => { setPage(size !== pageSize ? 1 : next); setPageSize(size) }}
          />
        )}
      </ModalBody>
    </ComposedModal>
  )
}
