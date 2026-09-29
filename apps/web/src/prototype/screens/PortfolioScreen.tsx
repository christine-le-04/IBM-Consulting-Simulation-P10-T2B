/**
 * Portfolio — design doc §4 screen 10: "already proportionate, no change
 * needed". Every PortfolioPage section is kept (stats, competency progression
 * with history toggle, the attempts chart and its legend, completed
 * engagements, replay comparison, achievements). Skin: a consultant's profile.
 */
import { useMemo, useState } from 'react'
import { Button, Checkbox, Tag } from '@carbon/react'
import { Locked, TrophyFilled } from '@carbon/icons-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { achievementDescription } from '@/features/achievement/achievementPresentation'
import { ACHIEVEMENTS, LEARNER_NAME, PERSONA, PORTFOLIO } from '../data/scenario'
import IndustryArt from '../shell/IndustryArt'
import Choice from '../shell/Choice'
import styles from './portfolio.module.scss'

const COLOURS = ['#0f62fe', '#24a148', '#1192e8', '#da1e28']
const WON = ['PILOT_APPROVED', 'PROPOSAL_ACCEPTED', 'STRATEGIC_PARTNERSHIP', 'WON']
const LOST = ['REJECTED', 'PROPOSAL_REJECTED', 'LOST']

export default function PortfolioScreen() {
  const [history, setHistory] = useState(false)
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [hovered, setHovered] = useState<string | null>(null)
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const portfolio = PORTFOLIO
  const completed = [...portfolio.completedEngagementsHistory].reverse()

  const chart = useMemo(() => portfolio.completedEngagementsHistory.map((engagement, index) => {
    const point: Record<string, string | number> = { attempt: `Attempt ${index + 1}` }
    portfolio.competencyTrends.forEach((trend, trendIndex) => {
      const match = trend.points.find((item) => item.engagementId === engagement.engagementId)
      if (match) point[`c${trendIndex}`] = match.score
    })
    return point
  }), [portfolio])

  const snapshot = (id: string) => {
    const engagement = portfolio.completedEngagementsHistory.find((item) => item.engagementId === id)
    if (!engagement) return null
    return {
      ...engagement,
      scores: portfolio.competencyTrends.map((trend) => ({ name: trend.competencyName, score: trend.points.find((point) => point.engagementId === id)?.score ?? 0 })),
    }
  }
  const replayOptions = [{ value: '', label: 'Select an engagement…' }, ...completed.map((item) => ({ value: item.engagementId, label: `${item.scenarioTitle} — ${item.overallScore}/100` }))]
  const left = snapshot(a)
  const right = snapshot(b)

  return (
    <div className={styles.page}>
      <header className={styles.profile}>
        <span className={styles.avatar} aria-hidden="true">VT</span>
        <div>
          <h1>{LEARNER_NAME}</h1>
          <p>Associate Consultant · IBM Consulting</p>
          <p className={styles.welcome}>Welcome {LEARNER_NAME.split(' ')[0]}, see your competency growth and completed engagement history across every scenario.</p>
        </div>
      </header>

      <section className={styles.stats}>
        <div><span>Completed engagements</span><strong>{portfolio.completedEngagements} / {portfolio.totalEngagements}</strong><small>{portfolio.totalEngagements - portfolio.completedEngagements} still in progress</small></div>
        <div><span>Contracts won</span><strong className={styles.good}>{portfolio.contractsWon}</strong></div>
        <div><span>Contracts lost</span><strong className={styles.bad}>{portfolio.contractsLost}</strong></div>
        <div><span>Average score</span><strong>{portfolio.averageOverallScore || '—'}</strong></div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Competency progression</h2>
          <Button kind="ghost" size="sm" onClick={() => setHistory((value) => !value)}>{history ? 'Hide history' : 'View history'}</Button>
        </div>
        <div className={styles.trends}>
          {portfolio.competencyTrends.map((trend) => {
            const points = [...trend.points].sort((x, y) => new Date(x.generatedAt).getTime() - new Date(y.generatedAt).getTime())
            const delta = points.length > 1 ? points[points.length - 1].score - points[0].score : 0
            return (
              <div key={trend.competencyName} className={styles.trend}>
                <div className={styles.trendHead}>
                  <strong>{trend.competencyName}</strong>
                  {points.length > 1 && <Tag type={delta >= 0 ? 'green' : 'red'} size="sm">{delta >= 0 ? '+' : ''}{delta} since first attempt</Tag>}
                </div>
                {(history ? points : points.slice(-1)).map((point) => (
                  <div key={point.engagementId} className={styles.trendRow}>
                    <span>{new Date(point.generatedAt).toLocaleDateString('en-GB')}</span>
                    <div className={styles.bar}><i style={{ width: `${point.score}%` }} /></div>
                    <strong>{point.score}</strong>
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        <div className={styles.chartCard}>
          <h3>Progress across attempts</h3>
          <p>Track how each competency has changed across your completed engagements.</p>
          <div className={styles.chart}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chart} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis dataKey="attempt" tick={{ fill: '#525252', fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fill: '#525252', fontSize: 12 }} />
                <Tooltip />
                {portfolio.competencyTrends.map((trend, index) => {
                  const dimmed = hovered !== null && hovered !== trend.competencyName
                  return (
                    <Line
                      key={trend.competencyName}
                      type="monotone"
                      dataKey={`c${index}`}
                      name={trend.competencyName}
                      stroke={COLOURS[index % COLOURS.length]}
                      strokeWidth={dimmed ? 0.5 : 1.75}
                      strokeOpacity={dimmed ? 0.25 : 1}
                      hide={hidden.has(trend.competencyName)}
                      isAnimationActive={false}
                      onMouseEnter={() => setHovered(trend.competencyName)}
                      onMouseLeave={() => setHovered(null)}
                    />
                  )
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className={styles.legend}>
            {portfolio.competencyTrends.map((trend, index) => (
              <div key={trend.competencyName} style={{ '--c': COLOURS[index % COLOURS.length] } as React.CSSProperties}>
                <Checkbox
                  id={`legend-${index}`}
                  labelText={trend.competencyName}
                  checked={!hidden.has(trend.competencyName)}
                  onChange={() => setHidden((current) => {
                    const next = new Set(current)
                    if (next.has(trend.competencyName)) next.delete(trend.competencyName)
                    else next.add(trend.competencyName)
                    return next
                  })}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Completed engagements ({portfolio.completedEngagements} of {portfolio.totalEngagements})</h2>
        <div className={styles.history}>
          {completed.map((item) => (
            <article key={item.engagementId} className={styles.historyCard}>
              <div className={styles.historyHead}>
                <IndustryArt industry={item.industry} size={44} />
                <h3>{item.scenarioTitle}</h3>
              </div>
              <div className={styles.tags}>
                <Tag type={WON.includes(item.outcome) ? 'green' : LOST.includes(item.outcome) ? 'red' : 'purple'} size="sm">{item.outcome.replace(/_/g, ' ')}</Tag>
                <Tag type="cyan" size="sm">{item.industry}</Tag>
              </div>
              <div className={styles.historyMeta}>
                <span>{item.completedAt ? new Date(item.completedAt).toLocaleDateString('en-GB') : 'In review'}</span>
                <strong>{item.overallScore}/100</strong>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Replay comparison</h2>
        <div className={styles.replay}>
          <div className={styles.replayPickers}>
            <Choice id="replay-a" label="Engagement A" value={a} onChange={setA} options={replayOptions} />
            <Choice id="replay-b" label="Engagement B" value={b} onChange={setB} options={replayOptions} />
          </div>
          {left && right && (
            <div className={styles.replayGrid}>
              {[left, right].map((item, index) => (
                <div key={index} className={styles.snapshot}>
                  <h3>{item.scenarioTitle}</h3>
                  <p>vs. {PERSONA.name}</p>
                  <strong className={styles.snapshotScore}>{item.overallScore}/100</strong>
                  {item.scores.map((score) => <div key={score.name} className={styles.snapshotRow}><span>{score.name}</span><span>{score.score}</span></div>)}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Achievements</h2>
        <div className={styles.achievements}>
          {ACHIEVEMENTS.map((achievement) => (
            <article key={achievement.id} className={`${styles.badge} ${achievement.unlocked ? '' : styles.badgeLocked}`}>
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
          ))}
        </div>
      </section>
    </div>
  )
}
