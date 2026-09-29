/**
 * What the engagement shell shows around the page on screen: the mentor's
 * live line, the page's way forward, and which overlays are open.
 *
 * A page sets `mentorLine` and `nextStep` from its own state; the shell clears
 * both on every navigation, so a line can never outlive the page that set it.
 */
import { create } from 'zustand'
import type { EngagementPhase } from '@/api/types'

export interface ReadinessItem {
  label: string
  done: boolean
}

export interface NextStep {
  label: string
  /** Route to open, unless `onGo` is given. */
  to?: string
  /** Runs instead of opening `to`, e.g. to advance the engagement first. */
  onGo?: () => void
  /**
   * False while the backend still refuses the step until the checklist is met:
   * the checklist then offers only the "stay" button, never "Continue anyway".
   */
  allowEarly?: boolean
  /** True once the step's checklist is met; the button then turns primary. */
  ready: boolean
  /** Word-only conditions shown when the step is taken before they are met. */
  checklist?: ReadinessItem[]
  checklistTitle?: string
  /** Label of the "stay" button in the checklist, e.g. "Keep researching". */
  stayLabel?: string
}

const BRIEF_STORAGE_KEY = 'consulting-sim:brief-dismissed'

function readDismissed(): Record<string, true> {
  try {
    return JSON.parse(localStorage.getItem(BRIEF_STORAGE_KEY) ?? '{}') as Record<string, true>
  } catch {
    return {}
  }
}

export function briefKey(engagementId: string, phase: EngagementPhase) {
  return `${engagementId}:${phase}`
}

interface ShellState {
  mentorLine: string | null
  nextStep: NextStep | null
  mapOpen: boolean
  caseFileOpen: boolean
  /** Step briefs the learner has folded away, by engagement and phase. */
  briefDismissed: Record<string, true>
  setMentorLine: (line: string | null) => void
  setNextStep: (step: NextStep | null) => void
  setMapOpen: (open: boolean) => void
  setCaseFileOpen: (open: boolean) => void
  setBriefDismissed: (key: string, dismissed: boolean) => void
  /** Called by the shell on every navigation. */
  resetForPage: () => void
}

export const useShellStore = create<ShellState>((set, get) => ({
  mentorLine: null,
  nextStep: null,
  mapOpen: false,
  caseFileOpen: false,
  briefDismissed: readDismissed(),
  setMentorLine: (mentorLine) => set({ mentorLine }),
  setNextStep: (nextStep) => set({ nextStep }),
  setMapOpen: (mapOpen) => set({ mapOpen }),
  setCaseFileOpen: (caseFileOpen) => set({ caseFileOpen }),
  setBriefDismissed: (key, dismissed) => {
    const next = { ...get().briefDismissed }
    if (dismissed) next[key] = true
    else delete next[key]
    try {
      localStorage.setItem(BRIEF_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Private windows can refuse storage; the brief then reopens next visit.
    }
    set({ briefDismissed: next })
  },
  resetForPage: () => set({ mentorLine: null, nextStep: null, mapOpen: false, caseFileOpen: false }),
}))
