import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Which contact (one of the scenario's people) the learner chose for each
 * engagement. UI only for now: kept in this browser until the backend stores it.
 */
export interface ContactChoice {
  personaId: string
  /** Saved with the choice so the map and Make contact can show it without loading the scenario. */
  name: string
  jobTitle: string
  /** Emails already sent when this contact was chosen. Emails after this count toward this contact. */
  emailsBefore: number
}

interface ContactSelectionState {
  byEngagement: Record<string, ContactChoice>
  choose: (engagementId: string, contact: { id: string; name: string; jobTitle: string }, emailsSoFar: number) => void
}

export const useContactSelectionStore = create<ContactSelectionState>()(
  persist(
    (set) => ({
      byEngagement: {},
      choose: (engagementId, contact, emailsSoFar) =>
        set((state) => ({
          byEngagement: {
            ...state.byEngagement,
            [engagementId]: { personaId: contact.id, name: contact.name, jobTitle: contact.jobTitle, emailsBefore: emailsSoFar },
          },
        })),
    }),
    { name: 'ibm-sim-contact-selection' },
  ),
)

/** The contact chosen for one engagement, or undefined if none yet. */
export const useChosenContact = (engagementId: string) =>
  useContactSelectionStore((state) => state.byEngagement[engagementId])

/** Same, outside React (e.g. in routing). */
export const getChosenContact = (engagementId: string) =>
  useContactSelectionStore.getState().byEngagement[engagementId]