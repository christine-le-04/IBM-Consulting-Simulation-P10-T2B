import { QueryClient } from '@tanstack/react-query'
import { create } from 'zustand'
import { useAuthStore } from '@/store/authStore'
import { useEngagementStore } from '@/store/engagementStore'
import { useShellStore } from '@/components/shell/shellStore'

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 1, staleTime: 30_000 },
    },
  })
}

let sessionRequests = new AbortController()

/** A separate cache and request lifetime for each authenticated session. */
export const useSessionBoundary = create(() => ({
  queryClient: createQueryClient(),
  revision: 0,
  signal: sessionRequests.signal,
}))

useAuthStore.subscribe((current, previous) => {
  if (current.userId === previous.userId && current.token === previous.token && current.role === previous.role) return

  const oldSession = useSessionBoundary.getState()
  sessionRequests.abort()
  sessionRequests = new AbortController()
  // clear cancels active queries and removes both query and mutation caches.
  // A fresh client also isolates callbacks that still reference the old client.
  oldSession.queryClient.clear()
  useEngagementStore.getState().setActiveEngagement(null)
  useShellStore.getState().resetForPage()
  useSessionBoundary.setState({
    queryClient: createQueryClient(),
    revision: oldSession.revision + 1,
    signal: sessionRequests.signal,
  })
})
