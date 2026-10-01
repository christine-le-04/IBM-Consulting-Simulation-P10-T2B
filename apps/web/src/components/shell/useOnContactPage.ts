import { useLocation } from 'react-router-dom'

/** True while the Choose contact page is on screen. */
export function useOnContactPage(): boolean {
  return /\/dashboard\/engagements\/[^/]+\/contact\/?$/.test(useLocation().pathname)
}