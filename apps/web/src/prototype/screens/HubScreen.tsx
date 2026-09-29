/**
 * 4 · The hub — the only destination (design doc §5.1 payload 1, FR-02, FR-03).
 *
 * Replaces the Command Centre outright. It answers three things and nothing
 * else: what is in flight, how to resume, how to start something new. The
 * floor is plain room buttons (simplified Option A); the manager's one line in
 * the lobby is Option C's graft. The catalogue, briefing and persona picker are
 * all kept — they move behind "Start a new engagement" instead of sitting on the page.
 */
import { useState } from 'react'
import { Button, Tag } from '@carbon/react'
import { Add, ArrowRight } from '@carbon/icons-react'
import type { Engagement, ScenarioSummary } from '@/api/types'
import { PHASE_LABEL } from '@/lifecycle/phases'
import { ENGAGEMENT, LEARNER_NAME, OTHER_ENGAGEMENTS, PORTFOLIO, SCENARIO } from '../data/scenario'
import { MANAGER } from '../data/voice'
import { useProto } from '../state/protoStore'
import { STAGES, SCREEN_ORDER, stageIndex } from '../state/stages'
import RoomGrid from '../shell/RoomGrid'
import DanaAvatar from '../shell/DanaAvatar'
import IndustryArt from '../shell/IndustryArt'
import CatalogueModal from './hub/CatalogueModal'
import BriefingModal from './hub/BriefingModal'
import styles from './hub/hub.module.scss'

type Status = { label: string; tag: 'blue' | 'cyan' | 'purple' | 'gray' | 'red' }

function statusOf(engagement: Engagement): Status {
  if (engagement.state === 'MEETING_FAILED') return { label: 'Meeting failed', tag: 'red' }
  if (engagement.state === 'COMPLETED') return { label: 'Completed', tag: 'gray' }
  if (engagement.state === 'REVIEW' || engagement.state === 'CLIENT_DECISION') return { label: 'Ready for review', tag: 'purple' }
  if (engagement.state === 'PROPOSAL_SUBMITTED') return { label: 'Awaiting response', tag: 'cyan' }
  return { label: 'Action required', tag: 'blue' }
}

/** Ten backend phases, six rooms. */
const PHASE_ROOM: Record<Engagement['phase'], number> = {
  LEAD: 0, CLIENT_INTELLIGENCE: 0, OUTREACH: 1, MEETING_PREPARATION: 2, LIVE_MEETING: 3,
  MEETING_REVIEW: 3, PROPOSAL: 4, OUTCOME: 4, REVIEW: 5, COMPLETED: 5,
}

function lobbyLine(activeCount: number, failed: number): string {
  if (failed > 0) return `You have ${ENGAGEMENT.leadCompanyName?.split(' ')[0]} open, and Kestrel is waiting on a meeting retry. Pick up MediCare first — Sarah replied to you.`
  if (activeCount > 1) return 'You have MediCare open. Want to pick up a second client while you wait on Harbourline?'
  return 'You have MediCare open. Sarah replied — that is where I would start.'
}

export default function HubScreen() {
  const variant = useProto((s) => s.hubVariant)
  const go = useProto((s) => s.go)
  const set = useProto((s) => s.set)
  const reached = useProto((s) => s.reached)
  const [catalogueOpen, setCatalogueOpen] = useState(false)
  const [briefing, setBriefing] = useState<ScenarioSummary | null>(null)

  const reachedScreen = SCREEN_ORDER[reached]
  const reachedStage = STAGES[stageIndex(reachedScreen)]
  const failed = OTHER_ENGAGEMENTS.filter((item) => item.state === 'MEETING_FAILED')
  const active = OTHER_ENGAGEMENTS.filter((item) => item.state !== 'MEETING_FAILED' && item.state !== 'COMPLETED')
  const firstVisit = variant === 'FIRST_VISIT'

  const startFlow = (scenario: ScenarioSummary) => {
    setCatalogueOpen(false)
    setBriefing(scenario)
  }
  /** A new engagement opens straight into research. The contact is chosen
   *  afterwards, on "Choose a client" — not in a modal before anything is known. */
  const confirmBriefing = () => {
    setBriefing(null)
    set({ reached: 0, briefDismissed: {}, contactId: null, outreachVariant: 'FIRST_CONTACT' })
    go('RESEARCH')
  }

  return (
    <div className={styles.page}>
      <header className={styles.lobby}>
        <div>
          <h1 className={styles.greeting}>{firstVisit ? `Welcome, ${LEARNER_NAME.split(' ')[0]}.` : `Morning, ${LEARNER_NAME.split(' ')[0]}.`}</h1>
        </div>
        <figure className={styles.managerSays}>
          <DanaAvatar size={48} />
          <blockquote>
            <p>
              {firstVisit
                ? 'Hi, I’m Dana — I’ll be your mentor on your first engagements. At every step I’ll tell you what it’s for and what you’re still missing. You start with no clients, so let’s win your first one.'
                : lobbyLine(active.length + 1, failed.length)}
            </p>
            <figcaption><strong>{MANAGER.name}</strong>, {MANAGER.role}</figcaption>
          </blockquote>
        </figure>
      </header>

      {firstVisit ? (
        <section className={styles.floorCard} aria-labelledby="first-run">
          <div className={styles.floorHead}>
            <div className={styles.identity}>
              <IndustryArt industry={SCENARIO.industry} size={64} />
              <div>
              <p className={styles.eyebrow}>Your first client</p>
              <h2 id="first-run">{SCENARIO.title}</h2>
              <p className={styles.floorMeta}><Tag type="cyan" size="sm">{SCENARIO.industry}</Tag> Complexity {SCENARIO.difficulty}/5</p>
              </div>
            </div>
            <div className={styles.floorActions}>
              <Button renderIcon={ArrowRight} onClick={() => setBriefing(SCENARIO)}>Start your first engagement</Button>
              <button type="button" className={styles.textLink} onClick={() => setCatalogueOpen(true)}>Or choose a different client</button>
            </div>
          </div>
          <ol className={styles.arc}>
            <li><strong>{PHASE_LABEL.CLIENT_INTELLIGENCE}</strong> — gather evidence on the client before interacting with them.</li>
            <li><strong>{PHASE_LABEL.OUTREACH}</strong> — reach out to understand their needs and earn a meeting.</li>
            <li><strong>{PHASE_LABEL.PROPOSAL}</strong> — build and present your case, then hear their decision.</li>
          </ol>
          <p className={styles.note}>Your interactions have consequences. The client reacts to what you actually do, and that shapes your final review.</p>
          <p className={styles.eyebrow}>Your office — each room opens when you finish the one before</p>
          <RoomGrid large fresh />
        </section>
      ) : (
        <div className={styles.grid}>
          <section className={styles.floorCard} aria-labelledby="in-flight">
            <div className={styles.floorHead}>
              <div className={styles.identity}>
                <IndustryArt industry={ENGAGEMENT.scenarioIndustry} size={64} />
                <div>
                <p className={styles.eyebrow}>On the floor now</p>
                <h2 id="in-flight">{ENGAGEMENT.leadCompanyName}</h2>
                <p className={styles.floorMeta}>
                  <Tag type="cyan" size="sm">{ENGAGEMENT.scenarioIndustry}</Tag>
                  {ENGAGEMENT.scenarioTitle}
                </p>
                </div>
              </div>
              <Tag type="blue">Action required</Tag>
            </div>

            {/* The one thing to do next comes first, above the floor plan. */}
            <div className={styles.next}>
              <div>
                <p className={styles.eyebrow}>Next · {reachedStage?.room}</p>
                <p className={styles.nextText}>{ENGAGEMENT.nextAction}</p>
                <p className={styles.facts}>
                  <span><strong>{ENGAGEMENT.evidenceCount}</strong> evidence</span>
                  <span><strong>{ENGAGEMENT.daysElapsed}</strong> days in</span>
                </p>
              </div>
              <Button size="lg" renderIcon={ArrowRight} onClick={() => go(reachedScreen)}>Continue</Button>
            </div>

            <RoomGrid large />
          </section>

          <aside className={styles.side}>
            <section className={styles.panel}>
              <div className={styles.panelHead}>
                <h3>Other engagements</h3>
                <Button kind="ghost" size="sm" renderIcon={Add} onClick={() => setCatalogueOpen(true)}>Start new</Button>
              </div>
              <ul className={styles.list}>
                {[...failed, ...active].map((item) => {
                  const status = statusOf(item)
                  return (
                    <li key={item.id}>
                      <button type="button" className={styles.row} onClick={() => go('HUB')}>
                        <IndustryArt industry={item.scenarioIndustry} size={36} />
                        <span className={styles.rowBody}>
                        <span className={styles.rowTop}>
                          <strong>{item.leadCompanyName}</strong>
                          <Tag type={status.tag} size="sm">{status.label}</Tag>
                        </span>
                        <span className={styles.rowMeta}>
                          {STAGES[PHASE_ROOM[item.phase]].room} · {item.scenarioIndustry}
                        </span>
                        <span className={styles.rowNext}>{item.nextAction}</span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHead}>
                <h3>Recently completed</h3>
                <Button kind="ghost" size="sm" onClick={() => go('PORTFOLIO')}>View all</Button>
              </div>
              <ul className={styles.list}>
                {PORTFOLIO.completedEngagementsHistory.slice(-2).reverse().map((item) => {
                  const lost = item.outcome.includes('REJECTED') || item.outcome.includes('LOST')
                  return (
                    <li key={item.engagementId} className={styles.completed}>
                      <IndustryArt industry={item.industry} size={32} />
                      <span className={styles.completedText}>
                        <strong>{item.scenarioTitle}</strong>
                        <small>{item.industry} · {new Date(item.completedAt ?? '').toLocaleDateString('en-GB')}</small>
                      </span>
                      <span className={styles.completedResult}>
                        <Tag type={lost ? 'red' : 'green'} size="sm">{item.outcome.replaceAll('_', ' ').toLowerCase()}</Tag>
                        <strong>{item.overallScore}/100</strong>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </section>
          </aside>
        </div>
      )}

      <CatalogueModal open={catalogueOpen} onClose={() => setCatalogueOpen(false)} onStart={startFlow} firstVisit={firstVisit} />
      <BriefingModal scenario={briefing} onCancel={() => setBriefing(null)} onConfirm={confirmBriefing} />
    </div>
  )
}
