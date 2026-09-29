/**
 * Review controls. Clearly outside the product: they let the team jump to any
 * screen and flip it between the states the real code can be in.
 */
import { useState } from 'react'
import { ChevronDown, ChevronUp } from '@carbon/icons-react'
import type { ClientDecisionOutcome } from '@/api/types'
import {
  useProto,
  type AssessmentVariant,
  type ClientMood,
  type HubVariant,
  type MeetingMode,
  type MeetingVariant,
  type OutreachVariant,
} from '../state/protoStore'
import { SCREEN_LABEL, SCREEN_ORDER, screenIndex, type ScreenId } from '../state/stages'
import styles from './shell.module.scss'

interface Option<T extends string> {
  value: T
  label: string
}

function Picker<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Option<T>[]; onChange: (value: T) => void }) {
  return (
    <label className={styles.picker}>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

const SCREENS: ScreenId[] = ['LANDING', 'HUB', ...SCREEN_ORDER, 'PORTFOLIO']

type SetState = ReturnType<typeof useProto.getState>['set']

/** Every "sad" branch of the team's user flow, one click away. */
const SAD_PATHS: { id: string; label: string; screen: ScreenId; apply: (set: SetState) => void }[] = [
  { id: 'declined', label: 'Outreach — declined, tries left', screen: 'OUTREACH', apply: (set) => set({ outreachVariant: 'REJECTED' }) },
  { id: 'exhausted', label: 'Outreach — 3 tries used, choose another contact', screen: 'OUTREACH', apply: (set) => set({ outreachVariant: 'EXHAUSTED' }) },
  { id: 'failed', label: 'Meeting — not interested, attempts left', screen: 'MEETING', apply: (set) => set({ meetingVariant: 'FAILED', mood: 'COOLING' }) },
  { id: 'noretries', label: 'Meeting — 3 attempts used, back to meeting prep', screen: 'MEETING', apply: (set) => set({ meetingVariant: 'NO_RETRIES', mood: 'COOLING' }) },
  { id: 'terminated', label: 'Meeting — client ended it early', screen: 'MEETING', apply: (set) => set({ meetingVariant: 'TERMINATED', mood: 'IMPATIENT' }) },
  { id: 'aierror', label: 'Meeting — AI reply failed', screen: 'MEETING', apply: (set) => set({ meetingVariant: 'AI_ERROR' }) },
  { id: 'revision', label: 'Decision — revision requested', screen: 'DECISION', apply: (set) => set({ decisionOutcome: 'REVISION_REQUESTED' }) },
  { id: 'deferred', label: 'Decision — deferred', screen: 'DECISION', apply: (set) => set({ decisionOutcome: 'DEFERRED' }) },
  { id: 'lost', label: 'Decision — rejected (deal lost)', screen: 'DECISION', apply: (set) => set({ decisionOutcome: 'REJECTED' }) },
  { id: 'lostreview', label: 'Review — after a lost deal', screen: 'ASSESSMENT', apply: (set) => set({ decisionOutcome: 'REJECTED', assessmentVariant: 'READY' }) },
  { id: 'hubretry', label: 'Office — engagement waiting on a meeting retry', screen: 'HUB', apply: (set) => set({ hubVariant: 'RETURNING' }) },
]

export default function PrototypeBar() {
  const [open, setOpen] = useState(true)
  const state = useProto()
  const { screen, set, go } = state

  return (
    <aside className={`${styles.protoBar} ${open ? '' : styles.protoBarClosed}`} aria-label="Prototype review controls">
      <button type="button" className={styles.protoToggle} onClick={() => setOpen((value) => !value)}>
        <b>PROTOTYPE ONLY</b> — review controls {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>
      {open && (
        <div className={styles.protoControls}>
          <Picker label="Screen" value={screen} options={SCREENS.map((id) => ({ value: id, label: SCREEN_LABEL[id] }))} onChange={go} />
          <label className={`${styles.picker} ${styles.sadPicker}`}>
            <span>Sad path</span>
            <select
              value=""
              onChange={(event) => {
                const path = SAD_PATHS.find((item) => item.id === event.target.value)
                if (!path) return
                go(path.screen)
                path.apply(set)
              }}
            >
              <option value="">Jump to a sad path…</option>
              {SAD_PATHS.map((path) => <option key={path.id} value={path.id}>{path.label}</option>)}
            </select>
          </label>
          <Picker
            label="Engagement reached"
            value={SCREEN_ORDER[state.reached]}
            options={SCREEN_ORDER.map((id) => ({ value: id, label: SCREEN_LABEL[id] }))}
            onChange={(id) => set({ reached: SCREEN_ORDER.indexOf(id) })}
          />

          {screen === 'LANDING' && (
            <Picker<'OUT' | 'IN'> label="Visitor" value={state.signedIn ? 'IN' : 'OUT'} onChange={(value) => set({ signedIn: value === 'IN' })} options={[
              { value: 'OUT', label: 'Not logged in' },
              { value: 'IN', label: 'Logged in, engagement in flight' },
            ]} />
          )}

          {screen === 'HUB' && (
            <Picker<HubVariant> label="Learner" value={state.hubVariant} onChange={(hubVariant) => set({ hubVariant })} options={[
              { value: 'RETURNING', label: 'Returning — engagements in flight' },
              { value: 'FIRST_VISIT', label: 'First visit — nothing started' },
            ]} />
          )}

          {screen === 'LEAD' && (
            <Picker<'OPEN' | 'CHOSEN'> label="Contact" value={state.reached > 1 ? 'CHOSEN' : 'OPEN'} onChange={(value) => set({ reached: value === 'OPEN' ? 1 : Math.max(state.reached, 2) })} options={[
              { value: 'OPEN', label: 'Not chosen yet' },
              { value: 'CHOSEN', label: 'Already chosen (locked)' },
            ]} />
          )}
          {screen === 'LEAD' && (
            <span className={styles.protoNote}>The later screens continue with Sarah Chen whichever contact you pick.</span>
          )}

          {screen === 'OUTREACH' && (
            <Picker<OutreachVariant> label="Mailbox state" value={state.outreachVariant} onChange={(outreachVariant) => set({ outreachVariant })} options={[
              { value: 'FIRST_CONTACT', label: 'Writing the first email' },
              { value: 'REPLY', label: 'Client replied — follow-up needed' },
              { value: 'BRIEF_REQUESTED', label: 'Writing the capability brief' },
              { value: 'MEETING_SECURED', label: 'Meeting accepted' },
              { value: 'REJECTED', label: 'Sad: declined, 2 tries left' },
              { value: 'EXHAUSTED', label: 'Sad: 3 tries used, lead closed' },
            ]} />
          )}

          {screen === 'MEETING' && (
            <>
              <Picker<MeetingMode> label="Difficulty" value={state.meetingMode} onChange={(meetingMode) => set({ meetingMode })} options={[
                { value: 'FREEFORM', label: 'Free text (SRS FR-11)' },
                { value: 'GUIDED', label: 'Guided — suggested replies' },
              ]} />
              <Picker<MeetingVariant> label="Meeting state" value={state.meetingVariant} onChange={(meetingVariant) => set({ meetingVariant })} options={[
                { value: 'IN_PROGRESS', label: 'In progress' },
                { value: 'READY_TO_CLOSE', label: 'Client ready to close' },
                { value: 'AI_ERROR', label: 'AI reply failed (AI-05)' },
                { value: 'PASSED', label: 'Ended — passed' },
                { value: 'FAILED', label: 'Sad: not interested, attempts left' },
                { value: 'NO_RETRIES', label: 'Sad: 3 attempts used, back to prep' },
                { value: 'TERMINATED', label: 'Sad: client ended it early' },
              ]} />
            </>
          )}

          {screenIndex(screen) >= screenIndex('MEETING') && screen !== 'ASSESSMENT' && (
            <Picker<ClientMood> label="Client state" value={state.mood} onChange={(mood) => set({ mood })} options={[
              { value: 'WARM', label: 'Warm' },
              { value: 'GUARDED', label: 'Guarded' },
              { value: 'IMPATIENT', label: 'Impatient' },
              { value: 'COOLING', label: 'Cooling' },
            ]} />
          )}

          {screen === 'DECISION' && (
            <Picker<ClientDecisionOutcome> label="Client decision" value={state.decisionOutcome} onChange={(decisionOutcome) => set({ decisionOutcome })} options={[
              { value: 'REVISION_REQUESTED', label: 'Revision requested' },
              { value: 'PILOT_APPROVED', label: 'Pilot approved' },
              { value: 'PROPOSAL_ACCEPTED', label: 'Proposal accepted' },
              { value: 'FURTHER_DISCOVERY_REQUIRED', label: 'Further discovery required' },
              { value: 'DEFERRED', label: 'Deferred' },
              { value: 'REJECTED', label: 'Sad: rejected (deal lost)' },
              { value: 'STRATEGIC_PARTNERSHIP', label: 'Strategic partnership' },
            ]} />
          )}

          {screen === 'ASSESSMENT' && (
            <Picker<AssessmentVariant> label="Assessment" value={state.assessmentVariant} onChange={(assessmentVariant) => set({ assessmentVariant })} options={[
              { value: 'READY', label: 'Coaching ready' },
              { value: 'COACHING_PENDING', label: 'AI coaching still writing' },
              { value: 'GENERATING', label: 'Generating assessment' },
              { value: 'TOO_EARLY', label: 'Opened too early' },
            ]} />
          )}
          <span className={styles.protoNote}>Numbers never appear on play screens (FR-14, R4). They are still computed underneath.</span>
        </div>
      )}
    </aside>
  )
}
