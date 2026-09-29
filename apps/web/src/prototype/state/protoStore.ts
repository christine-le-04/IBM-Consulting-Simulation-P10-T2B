/**
 * Prototype-only state. Stands in for React Query + the backend so reviewers
 * can walk the whole engagement without an account.
 *
 * Every value here maps to a real API field (see api/types.ts). When a screen
 * moves into src/pages, its reads from this store become the existing hooks.
 */
import { create } from 'zustand'
import type { ClientDecisionOutcome, PersonaState, ResearchEvidence } from '@/api/types'
import { SEED_EVIDENCE } from '../data/research'
import { SCREEN_ORDER, type ScreenId } from './stages'

export type HubVariant = 'RETURNING' | 'FIRST_VISIT'
export type OutreachVariant = 'FIRST_CONTACT' | 'REPLY' | 'BRIEF_REQUESTED' | 'MEETING_SECURED' | 'REJECTED' | 'EXHAUSTED'
export type MeetingMode = 'GUIDED' | 'FREEFORM'
export type MeetingVariant = 'IN_PROGRESS' | 'READY_TO_CLOSE' | 'AI_ERROR' | 'PASSED' | 'FAILED' | 'NO_RETRIES' | 'TERMINATED'
export type AssessmentVariant = 'READY' | 'COACHING_PENDING' | 'GENERATING' | 'TOO_EARLY'
export type ClientMood = 'WARM' | 'GUARDED' | 'IMPATIENT' | 'COOLING'

/** The numbers stay in code, where the game rules use them (AI-04). The
 *  learner only ever sees the cue they produce (FR-14). */
export const MOOD_STATE: Record<ClientMood, Omit<PersonaState, 'engagementId' | 'disclosedFacts'>> = {
  WARM: { trust: 82, interest: 78, patience: 88 },
  GUARDED: { trust: 64, interest: 72, patience: 80 },
  IMPATIENT: { trust: 71, interest: 66, patience: 41 },
  COOLING: { trust: 44, interest: 48, patience: 57 },
}

interface ProtoState {
  screen: ScreenId
  /** Furthest engagement screen reached, as an index into SCREEN_ORDER. */
  reached: number
  hubVariant: HubVariant
  /** The landing page is public, but a signed-in visitor sees their own next step. */
  signedIn: boolean
  outreachVariant: OutreachVariant
  meetingMode: MeetingMode
  meetingVariant: MeetingVariant
  decisionOutcome: ClientDecisionOutcome
  assessmentVariant: AssessmentVariant
  mood: ClientMood
  /** The person chosen to contact after research (team flow, 28 Sep). */
  contactId: string | null
  evidence: ResearchEvidence[]
  /** Screens whose threshold brief has been dismissed. */
  briefDismissed: Partial<Record<ScreenId, boolean>>
  mapOpen: boolean
  caseFileOpen: boolean
  /** A screen's live "what is missing" line, spoken by the manager in the strip. */
  liveLine: string | null
  /** The screen's way forward, shown beside the manager's line. */
  nextStep: {
    label: string
    screen: ScreenId
    ready: boolean
    /** Word-only conditions shown when the step is taken before they are met. */
    checklist?: { label: string; done: boolean }[]
    checklistTitle?: string
    stayLabel?: string
  } | null
  go: (screen: ScreenId) => void
  set: (patch: Partial<Omit<ProtoState, 'go' | 'set' | 'addEvidence'>>) => void
  addEvidence: (item: Omit<ResearchEvidence, 'id' | 'engagementId' | 'sequenceNo' | 'createdAt'>) => ResearchEvidence
}

export const useProto = create<ProtoState>((set, get) => ({
  screen: 'LANDING',
  reached: SCREEN_ORDER.indexOf('OUTREACH'),
  hubVariant: 'RETURNING',
  signedIn: false,
  outreachVariant: 'REPLY',
  meetingMode: 'FREEFORM',
  meetingVariant: 'IN_PROGRESS',
  decisionOutcome: 'REVISION_REQUESTED',
  assessmentVariant: 'READY',
  mood: 'GUARDED',
  contactId: 'persona-sarah',
  evidence: SEED_EVIDENCE,
  briefDismissed: {},
  mapOpen: false,
  caseFileOpen: false,
  liveLine: null,
  nextStep: null,
  go: (screen) => {
    const index = SCREEN_ORDER.indexOf(screen)
    set((state) => ({
      screen,
      reached: index > state.reached ? index : state.reached,
      mapOpen: false,
      caseFileOpen: false,
      liveLine: null,
      nextStep: null,
    }))
    window.scrollTo({ top: 0 })
  },
  set: (patch) => set(patch),
  addEvidence: (item) => {
    const evidence = get().evidence
    const created: ResearchEvidence = {
      ...item,
      id: `ev-${Date.now()}`,
      engagementId: 'eng-medicare',
      sequenceNo: Math.max(0, ...evidence.map((entry) => entry.sequenceNo)) + 1,
      createdAt: new Date().toISOString(),
    }
    set({ evidence: [...evidence, created] })
    return created
  },
}))

export function evidenceCode(sequenceNo: number): string {
  return `E-${String(sequenceNo).padStart(2, '0')}`
}
