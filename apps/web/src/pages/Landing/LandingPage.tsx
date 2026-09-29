/**
 * The landing page — the first thing a visitor sees.
 *
 * One job: in a glance, say what this is (a consulting simulation), what you
 * get out of it (practice on a client who reacts, and feedback on it), and
 * give one obvious next step. The pictures are fragments of real screens, in
 * the order a learner meets them; there are no logos, figures or testimonials
 * we cannot stand behind. Signed-in learners never land here — "/" sends them
 * to their office.
 */
import { Link } from 'react-router-dom'
import { Button } from '@carbon/react'
import { ArrowDown, ArrowRight } from '@carbon/icons-react'
import { ROOMS } from '@/components/shell/rooms'
import styles from './LandingPage.module.scss'

const ROOM_LINE: Record<string, string> = {
  RESEARCH: 'Research the company, choose who to contact',
  MAIL: 'Earn a meeting by email',
  PREP: 'Plan what you need to learn',
  MEETING: 'Talk it through with the client',
  PROPOSAL: 'Pitch, then hear their decision',
  REVIEW: 'See exactly how you did',
}

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} to="/">
          <span className={styles.brandIbm}>IBM</span> Consulting Simulation
        </Link>
        <nav className={styles.nav} aria-label="Page sections">
          <a href="#how" onClick={(event) => { event.preventDefault(); scrollTo('how') }}>How it works</a>
          <a href="#get" onClick={(event) => { event.preventDefault(); scrollTo('get') }}>What you get</a>
        </nav>
        <div className={styles.headerActions}>
          <Button as={Link} to="/login" kind="ghost" size="md">Log in</Button>
          <Button as={Link} to="/register" size="md">Sign up</Button>
        </div>
      </header>

      <section className={styles.hero} id="top">
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>IBM Consulting · Training simulation</p>
          <h1>Win your first client before you meet a real one.</h1>
          <p className={styles.lede}>
            Research a company, email the decision maker, run the meeting and pitch — to an AI client who reacts to everything you do.
          </p>
          <div className={styles.ctas}>
            <Button as={Link} to="/register" size="lg" renderIcon={ArrowRight}>Start your first engagement</Button>
            <Button size="lg" kind="tertiary" renderIcon={ArrowDown} onClick={() => scrollTo('how')}>See how it works</Button>
          </div>
          <p className={styles.reassure}>No consulting experience needed. Every step tells you what to do.</p>
        </div>

        {/* Fragments of three steps, in the order a learner meets them. */}
        <div className={styles.showcase} aria-label="What the simulation looks like">
          <figure className={`${styles.shot} ${styles.shotNews}`}>
            <figcaption>Research</figcaption>
            <div className={styles.newsMast}>The Client Observer</div>
            <p className={styles.newsHead}>Regional network delays clinical systems review as winter pressures mount</p>
            <p className={styles.newsSaved}><span>Saved as evidence</span> “Staff re-enter patient details into three separate systems.”</p>
          </figure>
          <figure className={`${styles.shot} ${styles.shotMail}`}>
            <figcaption>Outreach</figcaption>
            <p className={styles.mailFrom}><strong>Sarah Chen</strong> replied</p>
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
          {ROOMS.map((room, index) => (
            <li key={room.id}>
              <span className={styles.trackNo}>{String(index + 1).padStart(2, '0')}</span>
              <strong>{room.name}</strong>
              <span>{ROOM_LINE[room.id]}</span>
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
              {([['Research & Discovery', 86], ['Relationship', 84], ['Commercial reasoning', 58]] as const).map(([name, score]) => (
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
        <h2>Your first client is waiting.</h2>
        <Button as={Link} to="/register" size="lg" kind="secondary" renderIcon={ArrowRight}>Start your first engagement</Button>
      </section>

      <footer className={styles.footer}>
        <span><b>IBM</b> Consulting Simulation</span>
        <span>IBM × RMIT Capstone</span>
      </footer>
    </div>
  )
}
