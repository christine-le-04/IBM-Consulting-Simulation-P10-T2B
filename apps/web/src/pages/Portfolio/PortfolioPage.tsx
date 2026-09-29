/**
 * Portfolio — the learner's consultant profile: stats, competency progression
 * with its history toggle and chart, completed engagements, replay comparison
 * and achievements. This is where the numbers live (SRS FR-14 keeps them off
 * the play screens).
 */
import { useMemo, useState } from 'react'
import { Button, Checkbox, Tag } from '@carbon/react'
import { TrophyFilled, Locked } from '@carbon/icons-react'
import { usePortfolioSummary, useReplayComparison } from '@/api/hooks/usePortfolio'
import { useMyAchievements } from '@/api/hooks/useAchievements'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import LoadingState from '@/components/shared/LoadingState'
import ErrorState from '@/components/shared/ErrorState'
import type { AchievementSummary, CompetencyTrend, CompletedEngagementView } from '@/api/types'
import Choice from '@/components/shell/Choice'
import IndustryArt from '@/components/shell/IndustryArt'
import styles from './PortfolioPage.module.scss'
import { achievementDescription } from '@/features/achievement/achievementPresentation'
import { useAuthStore } from '@/store/authStore'

/** Lightweight competency trend visualisation: one row per historical score,
 *  avoiding a chart-library dependency while still showing progression clearly. */
function CompetencyTrendCard({ trend, showHistory }: { trend: CompetencyTrend, showHistory: boolean }) {
  const orderedPoints = [...trend.points].sort((a, b) =>
    new Date(a.generatedAt).getTime() - new Date(b.generatedAt).getTime()
  )
  const latest = orderedPoints[orderedPoints.length - 1]
  const first = orderedPoints[0]
  const delta = orderedPoints.length > 1 ? latest.score - first.score : 0
  const visiblePoints = showHistory ? orderedPoints : [latest]
  return (
    <div className={styles.trend}>
      <div className={styles.trendHead}>
        <strong>{trend.competencyName}</strong>
        {trend.points.length > 1 && (
          <Tag type={delta >= 0 ? 'green' : 'red'} size="sm">
            {delta >= 0 ? '+' : ''}{delta} since first attempt
          </Tag>
        )}
      </div>
      {visiblePoints.map((p) => (
        <div key={p.engagementId} className={styles.trendRow}>
          <span>{new Date(p.generatedAt).toLocaleDateString('en-GB')}</span>
          <div className={styles.bar}><i style={{ width: `${p.score}%` }} /></div>
          <strong className={styles.trendScore}>{p.score}</strong>
        </div>
      ))}
    </div>
  )
}

const colors = ['#0f62fe', '#24a148', '#1192e8', '#da1e28']

function CompetencyGraphLegend({ trends, hiddenCompetencies, toggleCompetency } : { trends: CompetencyTrend[], hiddenCompetencies: Set<string>, toggleCompetency: (competencyName: string) => void}) {
  return (
    <div className={styles.legend}>
      {trends.map((trend, index) => {
        const isHidden = hiddenCompetencies.has(trend.competencyName)

        return (
          <div key={trend.competencyName} style={{ '--c': colors[index % colors.length] } as React.CSSProperties}>
            <Checkbox
              id={`competency-${index}`}
              labelText={trend.competencyName}
              checked={!isHidden}
              onChange={() => toggleCompetency(trend.competencyName)}
            />
          </div>
        )
      })}
    </div>
  )
}

// responsive graph to show progress over attempts
function CompetencyTrendGraph({ trends }: { trends: CompetencyTrend[] }) {
  const [hoveredCompetency, setHoveredCompetency] = useState<string | null>(null)
  const [hiddenCompetencies, setHiddenCompetencies] = useState<Set<string>>(new Set())

  const chartData = useMemo(() => {
    const pointsByEngagement = new Map<string, {
      engagementId: string
      generatedAt: string
      [key: string]: string | number
    }>()

    trends.forEach((trend, trendIndex) => {
      trend.points.forEach((point) => {
        if (!pointsByEngagement.has(point.engagementId)) {
          pointsByEngagement.set(point.engagementId, {
            engagementId: point.engagementId,
            generatedAt: point.generatedAt,
          })
        }

        const existing = pointsByEngagement.get(point.engagementId)

        if (existing) {
          existing[`competency_${trendIndex}`] = point.score
        }
      })
    })

    return Array.from(pointsByEngagement.values())
      .sort((a, b) => new Date(a.generatedAt).getTime() - new Date(b.generatedAt).getTime())
      .map((point, index) => ({
        ...point,
        attempt: `Attempt ${index + 1}`,
      }))
  }, [trends])

  const toggleCompetency = (competencyName: string) => {
    setHiddenCompetencies((current) => {
      const next = new Set(current)

      if (next.has(competencyName)) {
        next.delete(competencyName)
      } else {
        next.add(competencyName)
      }

      return next
    })
  }

  if (trends.length === 0 || chartData.length === 0) return null

  return (
    <div className={styles.chartCard}>
      <h3>Progress Across Attempts</h3>
      <p>Track how each competency has changed across your completed engagements.</p>
      <div className={styles.chart}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="attempt" tick={{ fill: '#525252', fontSize: 12 }} axisLine={{ stroke: '#8d8d8d' }} tickLine={{ stroke: '#8d8d8d' }} />
              <YAxis domain={[0, 100]} tick={{ fill: '#525252', fontSize: 12 }} axisLine={{ stroke: '#8d8d8d' }} tickLine={{ stroke: '#8d8d8d' }} />
              <Tooltip
                formatter={(value, _name, item) => {
                  const trendIndex = Number(String(item.dataKey).replace('competency_', ''))
                  return [ value, trends[trendIndex]?.competencyName ?? 'Competency']
                }}
                labelFormatter={(label) => label}
              />
              {trends.map((trend, index) => {
                const isHidden = hiddenCompetencies.has(trend.competencyName)
                const isDimmed = hoveredCompetency !== null && hoveredCompetency !== trend.competencyName

                return (
                  <Line
                    key={ trend.competencyName }
                    type="monotone"
                    dataKey={ `competency_${index}` }
                    name={ trend.competencyName }
                    stroke={ colors[index % colors.length] }
                    strokeWidth={ isDimmed ? 0.5 : 1.75 }
                    strokeOpacity={ isDimmed ? 0.25 : 1 }
                    dot={{ r: isDimmed ? 1 : 2.5 }}
                    activeDot={{ r: isDimmed ? 2 : 5 }}
                    hide={ isHidden }
                    onMouseEnter={() => { setHoveredCompetency(trend.competencyName) }}
                    onMouseLeave={() => { setHoveredCompetency(null) }}
                  />
                )
              })}
            </LineChart>
          </ResponsiveContainer>
      </div>
      <CompetencyGraphLegend
        trends={trends}
        hiddenCompetencies={hiddenCompetencies}
        toggleCompetency={toggleCompetency}
      />
    </div>
  )
}

function EngagementHistoryRow({ engagement }: { engagement: CompletedEngagementView }) {
  const won = ['PILOT_APPROVED', 'PROPOSAL_ACCEPTED', 'STRATEGIC_PARTNERSHIP', 'WON']
    .includes(engagement.outcome)
  const rejected = ['REJECTED', 'PROPOSAL_REJECTED', 'LOST'].includes(engagement.outcome)
  return (
    <article className={styles.historyCard}>
      <div className={styles.historyHead}>
        <IndustryArt industry={engagement.industry} size={44} />
        <h3>{engagement.scenarioTitle}</h3>
      </div>
      <div className={styles.tags}>
        <Tag type={won ? 'green' : rejected ? 'red' : 'purple'} size="sm">{engagement.outcome.replace(/_/g, ' ')}</Tag>
        <Tag type="cyan" size="sm">{engagement.industry}</Tag>
      </div>
      <div className={styles.historyMeta}>
        <span>{engagement.completedAt ? new Date(engagement.completedAt).toLocaleDateString('en-GB') : 'In review'}</span>
        <strong>{engagement.overallScore}/100</strong>
      </div>
    </article>
  )
}

function ReplayComparisonSection({ history }: { history: CompletedEngagementView[] }) {
  const [engagementA, setEngagementA] = useState('')
  const [engagementB, setEngagementB] = useState('')
  const { data: comparison, isFetching } = useReplayComparison(engagementA, engagementB)

  if (history.length < 2) return null
  const options = [
    { value: '', label: 'Select an engagement…' },
    ...history.map((h) => ({ value: h.engagementId, label: `${h.scenarioTitle} — ${h.overallScore}/100` })),
  ]

  return (
    <section className={styles.section}>
      <h2>Replay comparison</h2>
      <div className={styles.replay}>
        <div className={styles.replayPickers}>
          <Choice id="replay-a" label="Engagement A" value={engagementA} onChange={setEngagementA} options={options} />
          <Choice id="replay-b" label="Engagement B" value={engagementB} onChange={setEngagementB} options={options} />
        </div>

        {isFetching && <LoadingState description="Loading comparison…" />}

        {comparison && (
          <div className={styles.replayGrid}>
            {[comparison.engagementA, comparison.engagementB].map((snapshot, idx) => (
              <div key={idx} className={styles.snapshot}>
                <h3>{snapshot.scenarioTitle}</h3>
                <p>vs. {snapshot.personaName}</p>
                <strong className={styles.snapshotScore}>{snapshot.overallScore}/100</strong>
                {snapshot.competencyScores.map((c) => (
                  <div key={c.competencyName} className={styles.snapshotRow}><span>{c.competencyName}</span><span>{c.score}</span></div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function AchievementBadge({ achievement }: { achievement: AchievementSummary }) {
  return (
    <article className={`${styles.badge} ${achievement.unlocked ? '' : styles.badgeLocked}`}>
      <div className={styles.badgeHead}>
        {achievement.unlocked ? <TrophyFilled size={20} /> : <Locked size={20} />}
        <strong>{achievement.name}</strong>
      </div>
      <p>{achievementDescription(achievement.description)}</p>
      {achievement.unlocked ? (
        <Tag type="green" size="sm">Unlocked {achievement.unlockedAt ? new Date(achievement.unlockedAt).toLocaleDateString('en-GB') : ''}</Tag>
      ) : (
        <div className={styles.badgeProgress}>
          <div className={styles.bar}><i style={{ width: `${achievement.progressPercent}%` }} /></div>
          <span>{Math.round(achievement.progressPercent)}% complete</span>
        </div>
      )}
    </article>
  )
}

function AchievementsSection() {
  const { data: achievements, isLoading } = useMyAchievements()

  if (isLoading || !achievements || achievements.length === 0) return null

  return (
    <section className={styles.section}>
      <h2>Achievements</h2>
      <div className={styles.achievements}>
        {achievements.map((a) => <AchievementBadge key={a.id} achievement={a} />)}
      </div>
    </section>
  )
}

export default function PortfolioPage() {
  const { data: portfolio, isLoading, isError } = usePortfolioSummary()
  const { displayName } = useAuthStore()
  const [showCompetencyHistory, setShowCompetencyHistory] = useState(false)
  const sortedHistory = useMemo(
    () => (portfolio?.completedEngagementsHistory ?? []).slice().reverse(),
    [portfolio],
  )

  if (isLoading) return <LoadingState />
  if (isError || !portfolio) return <ErrorState />

  const initials = (displayName ?? '').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className={styles.page}>
      <header className={styles.profile}>
        <span className={styles.avatar} aria-hidden="true">{initials || 'IBM'}</span>
        <div>
          <h1>{displayName ?? 'Your portfolio'}</h1>
          <p>Associate Consultant · IBM Consulting</p>
          <p className={styles.welcome}>
            {displayName
              ? `Welcome ${displayName}, see your competency growth and completed engagement history across every scenario.`
              : 'Your competency growth and completed engagement history across every scenario.'}
          </p>
        </div>
      </header>

      <section className={styles.stats} aria-label="Totals">
        <div>
          <span>Completed engagements</span>
          <strong>{portfolio.completedEngagements} / {portfolio.totalEngagements}</strong>
          <small>{portfolio.totalEngagements - portfolio.completedEngagements} still in progress</small>
        </div>
        <div><span>Contracts won</span><strong className={styles.good}>{portfolio.contractsWon}</strong></div>
        <div><span>Contracts lost</span><strong className={styles.bad}>{portfolio.contractsLost}</strong></div>
        <div><span>Average score</span><strong>{portfolio.averageOverallScore || '—'}</strong></div>
      </section>

      {portfolio.competencyTrends.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>Competency Progression</h2>
            {portfolio.competencyTrends.some((trend) => trend.points.length > 1) && (
              <Button kind="ghost" size="sm" onClick={() => setShowCompetencyHistory((current) => !current)}>
                {showCompetencyHistory ? 'Hide history' : 'View history'}
              </Button>
            )}
          </div>
          <div className={styles.trends}>
            {portfolio.competencyTrends.map((trend) => (
              <CompetencyTrendCard key={trend.competencyName} trend={trend} showHistory={showCompetencyHistory} />
            ))}
          </div>
          {portfolio.completedEngagements >= 2 ? (
            <CompetencyTrendGraph trends={portfolio.competencyTrends} />
          ) : (
            <div className={styles.chartCard}>
              <h3>Progress Across Attempts</h3>
              <p>Track your competency across your completed engagements. Complete at least 2 engagements to see your progress.</p>
            </div>
          )}
        </section>
      )}

      <section className={styles.section}>
        {sortedHistory.length > 0 ? (
          <>
            <h2>Completed engagements ({portfolio.completedEngagements} of {portfolio.totalEngagements})</h2>
            <div className={styles.history}>
              {sortedHistory.map((h) => <EngagementHistoryRow key={h.engagementId} engagement={h} />)}
            </div>
          </>
        ) : (
          <>
            <h2>Completed engagements</h2>
            <p className={styles.emptyState}>Complete your first engagement to start building your portfolio.</p>
          </>
        )}
      </section>

      <ReplayComparisonSection history={sortedHistory} />

      <AchievementsSection />
    </div>
  )
}
