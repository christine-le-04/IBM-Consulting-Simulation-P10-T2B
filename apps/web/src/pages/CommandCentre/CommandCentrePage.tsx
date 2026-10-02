/**
 * The Office — the hub every engagement starts and finishes in (it replaces
 * the Command Centre; the route and tour id are unchanged).
 *
 * It answers three things: what is in flight, how to resume, how to start
 * something new. The engagement on the floor gets the six rooms as plain
 * buttons; the mentor says one line in the lobby. The catalogue, briefing and
 * persona picker are kept, behind "Start new" instead of on the page.
 */
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button, InlineNotification, Tag, TextInput } from '@carbon/react'
import { Add, ArrowRight, Renew, Search } from '@carbon/icons-react'
import { useMyEngagements, useStartEngagement } from '@/api/hooks/useEngagements'
import { usePortfolioSummary } from '@/api/hooks/usePortfolio'
import { useScenarioCatalog } from '@/api/hooks/useScenarios'
import { resolveEngagementRoute } from '@/api/engagementRouting'
import { getApiProblem } from '@/api/problemDetails'
import type { CompletedEngagementView, Engagement, ScenarioSummary } from '@/api/types'
import ErrorState from '@/components/shared/ErrorState'
import LoadingState from '@/components/shared/LoadingState'
import ObjectiveTourProvider from '@/components/shared/ObjectiveTourProvider'
import Choice from '@/components/shell/Choice'
import DanaAvatar from '@/components/shell/DanaAvatar'
import IndustryArt from '@/components/shell/IndustryArt'
import { MENTOR } from '@/components/shell/mentor'
import RoomGrid from '@/components/shell/RoomGrid'
import { ROOMS, roomIndex } from '@/components/shell/rooms'
import { isActiveEngagement, requiresMeetingRetry } from '@/features/engagement/services/engagementLifecycleService'
import { PHASE_LABEL } from '@/lifecycle/phases'
import { useExperience } from '@/lifecycle/useExperience'
import { useAuthStore } from '@/store/authStore'
import ScenarioBriefingModal from './ScenarioBriefingModal'
import ScenarioCatalogueModal from './ScenarioCatalogueModal'
import styles from './CommandCentrePage.module.scss'

type Status = { label: string; tag: 'blue' | 'cyan' | 'purple' | 'gray' | 'red' }

/**
 * The Office walkthrough. Deliberately about where things are rather than what
 * to decide — the decisions are the thing being assessed.
 */
const COMMAND_CENTRE_OBJECTIVES = [
  {
    id: 'orientation',
    objective: 'This is your office',
    description:
      'Every engagement starts and finishes here. Your mentor, Dana, tells you where things stand, and your clients are on the floor below.',
    targets: ['.objective-command-centre'],
  },
  {
    id: 'arc',
    objective: 'How an engagement runs',
    description:
      'Research the client, reach out to them by email and in a live meeting, then present a proposal. Each stage follows the last, and the client reacts to what you do.',
    targets: ['.objective-engagement-arc'],
  },
  {
    id: 'start',
    objective: 'Start your first engagement',
    description:
      'This is a suggested client to begin with. You can look at other clients before deciding.',
    targets: ['.objective-start-engagement'],
  },
  {
    id: 'catalogue',
    objective: 'Every other client lives here',
    description:
      'Browse the full catalogue of clients when you want a different industry or difficulty.',
    targets: ['.objective-scenario-catalogue'],
  },
]

function statusOf(engagement: Engagement): Status {
  if (engagement.state === 'MEETING_FAILED') return { label: 'Meeting failed', tag: 'red' }
  if (engagement.state === 'COMPLETED') return { label: 'Completed', tag: 'gray' }
  if (engagement.state === 'REVIEW' || engagement.state === 'CLIENT_DECISION') return { label: 'Ready for review', tag: 'purple' }
  if (engagement.state === 'PROPOSAL_SUBMITTED') return { label: 'Awaiting response', tag: 'cyan' }
  return { label: 'Action required', tag: 'blue' }
}

type StatusFilter = 'ALL' | Status['label']
type SortMode = 'RECENT' | 'PROGRESS' | 'SCENARIO'

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'All engagements' },
  { value: 'Action required', label: 'Action required' },
  { value: 'Awaiting response', label: 'Awaiting response' },
  { value: 'Ready for review', label: 'Ready for review' },
  { value: 'Meeting failed', label: 'Meeting failed' },
]
const SORT_MODES: { value: SortMode; label: string }[] = [
  { value: 'RECENT', label: 'Recently active' },
  { value: 'PROGRESS', label: 'Progress' },
  { value: 'SCENARIO', label: 'Scenario' },
]

/** "Attempt #n" for engagements that repeat the same scenario and lead. */
function attemptLabels(engagements: Engagement[]) {
  const groups = new Map<string, Engagement[]>()
  engagements.forEach((engagement) => {
    const key = `${engagement.scenarioTitle ?? engagement.scenarioId}|${engagement.leadCompanyName ?? 'unselected'}`
    groups.set(key, [...(groups.get(key) ?? []), engagement])
  })
  const labels = new Map<string, string>()
  groups.forEach((items) => {
    if (items.length < 2) return
    ;[...items]
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .forEach((engagement, index) => labels.set(engagement.id, `Attempt #${index + 1}`))
  })
  return labels
}

function latestActivity(engagement: Engagement): number {
  const lastEvent = engagement.events?.[engagement.events.length - 1]?.occurredAt
  return new Date(lastEvent ?? engagement.createdAt).getTime()
}

function clientName(engagement: Engagement): string {
  return engagement.leadCompanyName ?? engagement.scenarioTitle ?? 'this client'
}

/** The mentor's one line in the lobby, picked from what is actually open. */
function lobbyLine(featured: Engagement | undefined, failed: Engagement[]): string {
  if (featured && failed.length > 0) {
    return `You have ${clientName(featured)} open, and ${clientName(failed[0])} is waiting on a meeting retry. I would finish ${clientName(featured)} first.`
  }
  if (featured) return `You have ${clientName(featured)} open. Next: ${featured.nextAction.charAt(0).toLowerCase()}${featured.nextAction.slice(1)}.`
  if (failed.length > 0) return `${clientName(failed[0])} is waiting on a meeting retry. Read the debrief before you go back in.`
  return 'Nothing on the floor right now. Pick your next client — a new industry is the fastest way to grow.'
}

function EngagementRow({ engagement, attemptLabel }: { engagement: Engagement; attemptLabel?: string }) {
  const navigate = useNavigate()
  const status = statusOf(engagement)
  return (
    <li>
      <button type="button" className={styles.row} onClick={() => navigate(resolveEngagementRoute(engagement))}>
        <IndustryArt industry={engagement.scenarioIndustry} size={36} />
        <span className={styles.rowBody}>
          <span className={styles.rowTop}>
            <strong>{clientName(engagement)}</strong>
            <Tag type={status.tag} size="sm">{status.label}</Tag>
          </span>
          <span className={styles.rowMeta}>
            {ROOMS[roomIndex(engagement.phase)]?.name} · {engagement.scenarioIndustry ?? 'Unassigned'}{attemptLabel ? ` · ${attemptLabel}` : ''}
          </span>
          <span className={styles.rowNext}>{engagement.nextAction}</span>
        </span>
      </button>
    </li>
  )
}

function CompletedRow({ item }: { item: CompletedEngagementView }) {
  const navigate = useNavigate()
  const lost = item.outcome.includes('REJECTED') || item.outcome.includes('LOST')
  return (
    <li>
      <button type="button" className={styles.completed} onClick={() => navigate(`/dashboard/engagements/${item.engagementId}/assessment`)}>
        <IndustryArt industry={item.industry} size={32} />
        <span className={styles.completedText}>
          <strong>{item.scenarioTitle}</strong>
          <small>{item.industry}{item.completedAt ? ` · ${new Date(item.completedAt).toLocaleDateString('en-GB')}` : ''}</small>
        </span>
        <span className={styles.completedResult}>
          <Tag type={lost ? 'red' : 'green'} size="sm">{item.outcome.replaceAll('_', ' ').toLowerCase()}</Tag>
          <strong>{item.overallScore}/100</strong>
        </span>
      </button>
    </li>
  )
}

export default function CommandCentrePage() {
  const { displayName } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const { data: engagements, isLoading: engLoading, isError: engError } = useMyEngagements()
  const { data: portfolio } = usePortfolioSummary()
  const startEngagement = useStartEngagement()
  const { data: starterPage, isLoading: scenLoading, isError: scenarioError } = useScenarioCatalog({ page: 0, size: 8 })
  const { stage } = useExperience()
  const firstVisit = stage === 'FIRST_VISIT'

  const [catalogueOpen, setCatalogueOpen] = useState(false)
  const [briefingScenario, setBriefingScenario] = useState<ScenarioSummary | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [sortMode, setSortMode] = useState<SortMode>('RECENT')

  const allEngagements = useMemo(() => engagements ?? [], [engagements])
  const active = useMemo(
    () => allEngagements.filter(isActiveEngagement).sort((a, b) => latestActivity(b) - latestActivity(a)),
    [allEngagements],
  )
  const failed = useMemo(
    () => allEngagements.filter(requiresMeetingRetry).sort((a, b) => latestActivity(b) - latestActivity(a)),
    [allEngagements],
  )
  const featured = active[0]
  const labelsByEngagement = useMemo(() => attemptLabels(allEngagements), [allEngagements])
  const others = useMemo(() => [...failed, ...active.slice(1)], [failed, active])
  const visibleOthers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    return others
      .filter((engagement) => statusFilter === 'ALL' || statusOf(engagement).label === statusFilter)
      .filter((engagement) => !query || [
        engagement.scenarioTitle, engagement.scenarioIndustry, engagement.leadCompanyName,
        PHASE_LABEL[engagement.phase], engagement.nextAction,
      ].some((value) => value?.toLowerCase().includes(query)))
      .sort((a, b) => {
        if (sortMode === 'PROGRESS') return b.progressPercent - a.progressPercent
        if (sortMode === 'SCENARIO') return (a.scenarioTitle ?? '').localeCompare(b.scenarioTitle ?? '')
        return latestActivity(b) - latestActivity(a)
      })
  }, [others, searchTerm, sortMode, statusFilter])
  const completedHistory = portfolio?.completedEngagementsHistory ?? []

  /**
   * One scenario, not two thousand. A newcomer has no basis for choosing
   * between them; the catalogue stays one click away for anyone who wants it.
   */
  const starterScenario = starterPage?.items[0] ?? null
  // A recommendation is something new: never a scenario already started.
  const recommended = starterPage?.items.find((item) => !allEngagements.some((engagement) => engagement.scenarioId === item.id)) ?? null

  // Shows a notification when the learner was redirected from a protected route.
  const [deniedReason, setDeniedReason] = useState<string | undefined>(
    (location.state as { deniedReason?: string } | null)?.deniedReason,
  )
  useEffect(() => {
    if (!deniedReason) return
    // Clears router state so the notification does not come back after a refresh.
    navigate(location.pathname, { replace: true, state: {} })
  }, [deniedReason, location.pathname, navigate])

  const beginEngagement = (scenario: ScenarioSummary, personaId?: string) => {
    startEngagement.mutate(
      { scenarioId: scenario.id, personaId, scenario },
      { onSuccess: ({ engagement }) => navigate(`/dashboard/engagements/${engagement.id}/intelligence`) },
    )
  }

  // Scenarios the learner is already playing continue where they left off.
  const inProgressByScenario = useMemo(
    () => new Map(active.map((engagement) => [engagement.scenarioId, engagement])),
    [active],
  )

  const openBriefing = (scenario: ScenarioSummary) => {
    setCatalogueOpen(false)
    const inProgress = inProgressByScenario.get(scenario.id)
    if (inProgress) {
      navigate(resolveEngagementRoute(inProgress))
      return
    }
    setBriefingScenario(scenario)
  }

  const confirmBriefing = () => {
    if (!briefingScenario) return
    const scenario = briefingScenario
    setBriefingScenario(null)
    // The backend still fixes the contact when an engagement starts. Once the
    // contact is chosen after research (SRS v2), this picker goes away.
    beginEngagement(scenario)
  }


  if (engLoading || scenLoading) return <LoadingState />
  if (engError || scenarioError) return <ErrorState />

  return (
    <ObjectiveTourProvider tourId="command-centre" objectives={COMMAND_CENTRE_OBJECTIVES}>
      <main className={styles.page}>
        {deniedReason && (
          <InlineNotification kind="warning" title="Access restricted" subtitle={deniedReason} onCloseButtonClick={() => setDeniedReason(undefined)} />
        )}
        {startEngagement.isError && (
          <InlineNotification
            kind="error"
            lowContrast
            title="Engagement could not be started"
            subtitle={getApiProblem(startEngagement.error, '').status === 422
              ? 'This scenario is not available to start right now. Choose another one.'
              : 'Check your connection, then try starting it again.'}
            onCloseButtonClick={() => startEngagement.reset()}
          />
        )}

        <header className={`${styles.lobby} objective-command-centre`}>
          <h1 className={styles.greeting}>{firstVisit ? `Welcome, ${displayName}.` : `Welcome back, ${displayName}.`}</h1>
          <figure className={styles.mentorSays}>
            <DanaAvatar size={48} />
            <blockquote>
              <p>
                {firstVisit
                  ? 'Hi, I’m Dana — I’ll be your mentor on your first engagements. At every step I’ll tell you what it’s for and what you’re still missing. You start with no clients, so let’s win your first one.'
                  : lobbyLine(featured, failed)}
              </p>
              <figcaption><strong>{MENTOR.name}</strong>, {MENTOR.role}</figcaption>
            </blockquote>
          </figure>
        </header>

        {firstVisit ? (
          <section className={styles.floorCard} aria-labelledby="first-run">
            {starterScenario ? (
              <div className={`${styles.floorHead} objective-start-engagement`}>
                <div className={styles.identity}>
                  <IndustryArt industry={starterScenario.industry} size={64} />
                  <div>
                    <p className={styles.eyebrow}>Your first client</p>
                    <h2 id="first-run">{starterScenario.title}</h2>
                    <div className={styles.floorMeta}>
                      <Tag type="cyan" size="sm">{starterScenario.industry}</Tag> Complexity {starterScenario.difficulty}/5
                    </div>
                  </div>
                </div>
                <div className={styles.floorActions}>
                  <Button renderIcon={ArrowRight} disabled={startEngagement.isPending} onClick={() => openBriefing(starterScenario)}>
                    {startEngagement.isPending ? 'Starting…' : 'Start your first engagement'}
                  </Button>
                  <button type="button" className={`${styles.textLink} objective-scenario-catalogue`} onClick={() => setCatalogueOpen(true)}>
                    Or choose a different client
                  </button>
                </div>
              </div>
            ) : (
              <p id="first-run" className={styles.note}>No scenarios are available yet. Check back shortly.</p>
            )}
            <ol className={`${styles.arc} objective-engagement-arc`}>
              <li><strong>{PHASE_LABEL.CLIENT_INTELLIGENCE}</strong> — gather evidence on the client before interacting with them.</li>
              <li><strong>{PHASE_LABEL.OUTREACH}</strong> — reach out to understand their needs and earn a meeting.</li>
              <li><strong>{PHASE_LABEL.PROPOSAL}</strong> — build and present your case, then hear their decision.</li>
            </ol>
            <p className={styles.note}>Your interactions have consequences. The client reacts to what you actually do, and that shapes your final review.</p>
            <p className={styles.eyebrow}>Your office — each room opens when you finish the one before</p>
            <RoomGrid large />
          </section>
        ) : (
          <div className={styles.grid}>
            {featured ? (
              <section className={styles.floorCard} aria-labelledby="in-flight">
                <div className={styles.floorHead}>
                  <div className={styles.identity}>
                    <IndustryArt industry={featured.scenarioIndustry} size={64} />
                    <div>
                      <p className={styles.eyebrow}>On the floor now</p>
                      <h2 id="in-flight">{clientName(featured)}</h2>
                      <div className={styles.floorMeta}>
                        <Tag type="cyan" size="sm">{featured.scenarioIndustry ?? 'Unassigned'}</Tag>
                        {featured.scenarioTitle}
                        {labelsByEngagement.get(featured.id) && <Tag type="gray" size="sm">{labelsByEngagement.get(featured.id)}</Tag>}
                      </div>
                    </div>
                  </div>
                  <Tag type={statusOf(featured).tag}>{statusOf(featured).label}</Tag>
                </div>

                {/* The one thing to do next comes first, above the floor plan. */}
                <div className={styles.next}>
                  <div>
                    <p className={styles.eyebrow}>Next · {ROOMS[roomIndex(featured.phase)]?.name}</p>
                    <p className={styles.nextText}>{featured.nextAction}</p>
                    <p className={styles.facts}>
                      <span><strong>{featured.evidenceCount}</strong> evidence</span>
                      <span><strong>{featured.daysElapsed}</strong> days in</span>
                    </p>
                  </div>
                  <Button size="lg" renderIcon={ArrowRight} onClick={() => navigate(resolveEngagementRoute(featured))}>Continue</Button>
                </div>

                <RoomGrid engagement={featured} large />
              </section>
            ) : (
              <section className={styles.floorCard} aria-labelledby="in-flight">
                <p className={styles.eyebrow}>On the floor now</p>
                <h2 id="in-flight" className={styles.emptyTitle}>No client on the floor</h2>
                <p className={styles.note}>Start a new engagement to fill the office.</p>
                <div><Button renderIcon={Add} onClick={() => setCatalogueOpen(true)}>Find your next client</Button></div>
              </section>
            )}

            <aside className={styles.side}>
              <section className={styles.panel}>
                <div className={styles.panelHead}>
                  <h3>Other engagements</h3>
                  <Button kind="ghost" size="sm" renderIcon={Add} className="objective-scenario-catalogue" onClick={() => setCatalogueOpen(true)}>Start new</Button>
                </div>
                {others.length > 1 && (
                  <div className={styles.listControls}>
                    <TextInput id="engagement-search" labelText="Search engagements" hideLabel size="sm" placeholder="Search engagements" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
                    <div className={styles.listFilters}>
                      <Choice id="status-filter" label="Filter" hideLabel size="sm" value={statusFilter} options={STATUS_FILTERS} onChange={setStatusFilter} />
                      <Choice id="sort-mode" label="Sort" hideLabel size="sm" value={sortMode} options={SORT_MODES} onChange={setSortMode} />
                    </div>
                  </div>
                )}
                {others.length === 0 ? (
                  <p className={styles.sideEmpty}>Nothing else in flight.</p>
                ) : visibleOthers.length > 0 ? (
                  <ul className={styles.list}>{visibleOthers.map((item) => <EngagementRow key={item.id} engagement={item} attemptLabel={labelsByEngagement.get(item.id)} />)}</ul>
                ) : (
                  <p className={styles.sideEmpty}><Search size={16} /> No engagements match this search.</p>
                )}
              </section>

              <section className={styles.panel}>
                <div className={styles.panelHead}>
                  <h3>Recently completed</h3>
                  <Button kind="ghost" size="sm" onClick={() => navigate('/dashboard/portfolio')}>View all</Button>
                </div>
                {completedHistory.length > 0 ? (
                  <ul className={styles.list}>{completedHistory.slice(0, 2).map((item) => <CompletedRow key={item.engagementId} item={item} />)}</ul>
                ) : (
                  <p className={styles.sideEmpty}>Completed engagements will appear here.</p>
                )}
              </section>

              {recommended && (
                <section className={styles.panel}>
                  <p className={styles.eyebrow}>Recommended for you</p>
                  <div className={styles.recommended}>
                    <IndustryArt industry={recommended.industry} size={40} />
                    <div>
                      <h3>{recommended.title}</h3>
                      <p>Practise stakeholder discovery and commercial evidence gathering in a fresh industry context.</p>
                    </div>
                  </div>
                  <Button kind="secondary" size="sm" renderIcon={Renew} disabled={startEngagement.isPending} onClick={() => openBriefing(recommended)}>
                    Start scenario
                  </Button>
                </section>
              )}
            </aside>
          </div>
        )}

        {catalogueOpen && (
          <ScenarioCatalogueModal
            firstVisit={firstVisit}
            isPending={startEngagement.isPending}
            inProgressScenarioIds={new Set(inProgressByScenario.keys())}
            onClose={() => setCatalogueOpen(false)}
            onStart={openBriefing}
          />
        )}

        {briefingScenario && (
          <ScenarioBriefingModal
            scenario={briefingScenario}
            onCancel={() => setBriefingScenario(null)}
            onConfirm={confirmBriefing}
            isPending={startEngagement.isPending}
          />
        )}
      </main>
    </ObjectiveTourProvider>
  )
}
