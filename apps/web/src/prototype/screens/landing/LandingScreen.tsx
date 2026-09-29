/**
 * Landing page — the first thing anyone sees, logged in or not.
 *
 * One job: in a glance, say what this is (a consulting simulation), what you
 * get out of it (practice on a client who reacts, and feedback on it), and
 * give one obvious next step. The pictures are real screens from the product,
 * not illustrations; there are no logos, figures or testimonials we cannot
 * stand behind. Signed-in visitors get their own next step instead of "Sign up".
 */
import { Button } from '@carbon/react'
import { ArrowRight, ArrowDown } from '@carbon/icons-react'
import { ENGAGEMENT, LEARNER_NAME, PERSONA } from '../../data/scenario'
import { useProto } from '../../state/protoStore'
import { SCREEN_ORDER, STAGES, stageIndex } from '../../state/stages'
import styles from './landing.module.scss'

const STAGE_LINE: Record<string, string> = {
  FIND_LEAD: 'Research the company, choose who to contact',
  OUTREACH: 'Earn a meeting by email',
  MEETING_PREP: 'Plan what you need to learn',
  MEETING: 'Talk it through with the client',
  PROPOSAL: 'Pitch, then hear their decision',
  REVIEW: 'See exactly how you did',
}

export default function LandingScreen() {
  const signedIn = useProto((s) => s.signedIn)
  const reached = useProto((s) => s.reached)
  const set = useProto((s) => s.set)
  const go = useProto((s) => s.go)
  const reachedScreen = SCREEN_ORDER[reached]
  const room = STAGES[stageIndex(reachedScreen)]?.room

  // In the product: /register for visitors; the office for signed-in learners.
  const start = () => { set({ hubVariant: 'FIRST_VISIT' }); go('HUB') }
  const resume = () => go(reachedScreen)
  const office = () => { set({ hubVariant: 'RETURNING' }); go('HUB') }
  const toHow = () => document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' })

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <a className={styles.brand} href="#top" onClick={(event) => event.preventDefault()}>
          <span className={styles.brandIbm}>IBM</span> Consulting Simulation
        </a>
        <nav className={styles.nav} aria-label="Page sections">
          <a href="#how" onClick={(event) => { event.preventDefault(); toHow() }}>How it works</a>
          <a href="#get" onClick={(event) => { event.preventDefault(); document.getElementById('get')?.scrollIntoView({ behavior: 'smooth' }) }}>What you get</a>
        </nav>
        <div className={styles.headerActions}>
          {signedIn ? (
            <Button size="md" onClick={office}>Go to your office</Button>
          ) : (
            <>
              <Button kind="ghost" size="md" onClick={office}>Log in</Button>
              <Button size="md" onClick={start}>Sign up</Button>
            </>
          )}
        </div>
      </header>

      <section className={styles.hero} id="top">
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>IBM Consulting · Training simulation</p>
          <h1>Win your first client before you meet a real one.</h1>
          <p className={styles.lede}>
            Research a company, email the decision maker, run the meeting and pitch — to an AI client who reacts to everything you do.
          </p>

          {signedIn ? (
            <div className={styles.resume}>
              <p>Welcome back, {LEARNER_NAME.split(' ')[0]}. <strong>{ENGAGEMENT.leadCompanyName}</strong> is waiting in the {room}.</p>
              <div className={styles.ctas}>
                <Button size="lg" renderIcon={ArrowRight} onClick={resume}>Continue engagement</Button>
                <Button size="lg" kind="tertiary" onClick={office}>Go to your office</Button>
              </div>
            </div>
          ) : (
            <>
              <div className={styles.ctas}>
                <Button size="lg" renderIcon={ArrowRight} onClick={start}>Start your first engagement</Button>
                <Button size="lg" kind="tertiary" renderIcon={ArrowDown} onClick={toHow}>See how it works</Button>
              </div>
              <p className={styles.reassure}>No consulting experience needed. Every step tells you what to do.</p>
            </>
          )}
        </div>

        {/* Real fragments of three steps, in the order a learner meets them. */}
        <div className={styles.showcase} aria-label="What the simulation looks like">
          <figure className={`${styles.shot} ${styles.shotNews}`}>
            <figcaption>Research</figcaption>
            <div className={styles.newsMast}>The Client Observer</div>
            <p className={styles.newsHead}>Regional network delays clinical systems review as winter pressures mount</p>
            <p className={styles.newsSaved}><span>Saved as evidence</span> “Staff re-enter patient details into three separate systems.”</p>
          </figure>
          <figure className={`${styles.shot} ${styles.shotMail}`}>
            <figcaption>Outreach</figcaption>
            <p className={styles.mailFrom}><strong>{PERSONA.name}</strong> replied</p>
            <p className={styles.mailBody}>“This is useful, and the phasing answers my main worry. I can give you 30 minutes on Thursday.”</p>
            <span className={styles.mailTag}>Meeting accepted</span>
          </figure>
          <figure className={`${styles.shot} ${styles.shotMeeting}`}>
            <figcaption>Meeting</figcaption>
            <p className={styles.bubbleClient}>“I have heard ‘we can fix that’ from three vendors. Why is your version different?”</p>
            <p className={styles.cue}><i aria-hidden="true" /> Sceptical — wants specifics before she believes you.</p>
          </figure>
        </div>
      </section>

      <section className={styles.how} id="how">
        <div className={styles.sectionHead}>
          <p className={styles.eyebrowDark}>How it works</p>
          <h2>One engagement, six rooms.</h2>
        </div>
        <ol className={styles.track}>
          {STAGES.map((stage, index) => (
            <li key={stage.id}>
              <span className={styles.trackNo}>{String(index + 1).padStart(2, '0')}</span>
              <strong>{stage.room}</strong>
              <span>{STAGE_LINE[stage.id]}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.get} id="get">
        <div className={styles.sectionHead}>
          <p className={styles.eyebrowDark}>What you get</p>
          <h2>Real practice. Honest feedback.</h2>
        </div>
        <div className={styles.benefits}>
          <article>
            <div className={styles.proof}>
              <p className={styles.cueLight}><i aria-hidden="true" /> Polite, but nothing you have said lands on a problem she owns.</p>
            </div>
            <h3>A client who pushes back</h3>
            <p>She stays in character, raises objections and only shares what you earn by asking the right question.</p>
          </article>
          <article>
            <div className={styles.proof}>
              {[['Research & Discovery', 86], ['Relationship', 84], ['Commercial reasoning', 58]].map(([name, score]) => (
                <div key={name} className={styles.bar}>
                  <span>{name}</span>
                  <b style={{ width: `${score}%` }} />
                  <em>{score}</em>
                </div>
              ))}
            </div>
            <h3>Feedback you can act on</h3>
            <p>A score for each competency, with coaching tied to what you actually did — not generic tips.</p>
          </article>
          <article>
            <div className={styles.proof}>
              <svg viewBox="0 0 240 72" className={styles.trend} role="img" aria-label="Competency trend rising across three engagements">
                <polyline points="8,58 120,34 232,14" fill="none" stroke="#0f62fe" strokeWidth="2" />
                <polyline points="8,48 120,40 232,22" fill="none" stroke="#24a148" strokeWidth="2" />
                {[[8, 58], [120, 34], [232, 14], [8, 48], [120, 40], [232, 22]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="3" fill="#fff" stroke="#161616" />)}
              </svg>
            </div>
            <h3>A record of your growth</h3>
            <p>Contracts won, relationship health and how each skill moves from one engagement to the next.</p>
          </article>
        </div>
      </section>

      <section className={styles.close}>
        <h2>{signedIn ? `${ENGAGEMENT.leadCompanyName?.split(' ')[0]} is still waiting on your reply.` : 'Your first client is waiting.'}</h2>
        {signedIn
          ? <Button size="lg" kind="secondary" renderIcon={ArrowRight} onClick={resume}>Continue engagement</Button>
          : <Button size="lg" kind="secondary" renderIcon={ArrowRight} onClick={start}>Start your first engagement</Button>}
      </section>

      <footer className={styles.footer}>
        <span><b>IBM</b> Consulting Simulation</span>
        <span>IBM × RMIT Capstone</span>
      </footer>
    </div>
  )
}
