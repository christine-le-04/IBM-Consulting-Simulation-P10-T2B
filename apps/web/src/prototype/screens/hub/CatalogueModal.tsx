/**
 * The scenario catalogue — kept whole (search, industry, difficulty, paging)
 * but moved off the hub page into the one place it is wanted: starting new work.
 */
import { useMemo, useState } from 'react'
import { Button, ComposedModal, Dropdown, ModalBody, ModalHeader, Pagination, Tag, TextInput } from '@carbon/react'
import { Add, Search } from '@carbon/icons-react'
import type { ScenarioSummary } from '@/api/types'
import { CATALOGUE, CATALOGUE_INDUSTRIES, CATALOGUE_TOTAL } from '../../data/scenario'
import IndustryArt from '../../shell/IndustryArt'
import styles from './hub.module.scss'

const DIFFICULTY_ITEMS = ['All difficulty', 'Guided', 'Standard', 'Advanced']
const DIFFICULTY_VALUE: Record<string, number | null> = { Guided: 2, Standard: 3, Advanced: 4 }

export default function CatalogueModal({ open, onClose, onStart, firstVisit }: {
  open: boolean
  onClose: () => void
  onStart: (scenario: ScenarioSummary) => void
  firstVisit: boolean
}) {
  const [search, setSearch] = useState('')
  // Filters reset to the first page, as useScenarioCatalog does.
  const [industry, setIndustry] = useState('All industries')
  const [difficulty, setDifficulty] = useState('All difficulty')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(8)

  const items = useMemo(() => CATALOGUE.filter((scenario) => {
    const text = `${scenario.title} ${scenario.industry} ${scenario.description}`.toLowerCase()
    return (!search.trim() || text.includes(search.trim().toLowerCase()))
      && (industry === 'All industries' || scenario.industry === industry)
      && (difficulty === 'All difficulty' || scenario.difficulty === DIFFICULTY_VALUE[difficulty])
  }), [difficulty, industry, search])
  const pageItems = items.slice((page - 1) * pageSize, page * pageSize)

  return (
    <ComposedModal open={open} onClose={onClose} size="lg" aria-label="Scenario catalogue">
      <ModalHeader label="Scenario catalogue" title={firstVisit ? 'Other clients' : 'Find your next client'} buttonOnClick={onClose} />
      <ModalBody className={styles.catalogueBody}>
        <p className={styles.note}>
          {firstVisit
            ? 'Any of these works as a first engagement. They differ in industry and difficulty, not in what you have to do.'
            : `Explore ${CATALOGUE_TOTAL.toLocaleString()} distinct, scenario-ready consulting engagements.`}
        </p>
        <div className={styles.catalogueControls}>
          <TextInput id="catalogue-search" labelText="Search scenarios" hideLabel placeholder="Search client, industry or opportunity" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} />
          <Dropdown id="catalogue-industry" titleText="Industry" hideLabel label="All industries" items={['All industries', ...CATALOGUE_INDUSTRIES]} selectedItem={industry} onChange={({ selectedItem }) => { setIndustry(selectedItem ?? 'All industries'); setPage(1) }} />
          <Dropdown id="catalogue-difficulty" titleText="Difficulty" hideLabel label="All difficulty" items={DIFFICULTY_ITEMS} selectedItem={difficulty} onChange={({ selectedItem }) => { setDifficulty(selectedItem ?? 'All difficulty'); setPage(1) }} />
        </div>
        {items.length ? (
          <div className={styles.scenarioGrid}>
            {pageItems.map((scenario) => (
              <article key={scenario.id} className={styles.scenarioCard}>
                <IndustryArt industry={scenario.industry} size={56} />
                <div className={styles.scenarioTags}>
                  <Tag type="cyan" size="sm">{scenario.industry}</Tag>
                  <Tag type="gray" size="sm">Complexity: {scenario.difficulty}/5</Tag>
                </div>
                <h4>{scenario.title}</h4>
                <p>{scenario.description}</p>
                <Button renderIcon={Add} size="sm" onClick={() => onStart(scenario)}>Start Engagement</Button>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.empty}><Search size={20} /> No scenarios match these filters.</div>
        )}
        <Pagination
          page={page}
          pageSize={pageSize}
          pageSizes={[8, 16, 24]}
          totalItems={items.length}
          onChange={({ page: next, pageSize: size }) => { setPage(size !== pageSize ? 1 : next); setPageSize(size) }}
        />
      </ModalBody>
    </ComposedModal>
  )
}
