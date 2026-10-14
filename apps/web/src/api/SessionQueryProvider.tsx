import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useSessionBoundary } from '@/api/sessionBoundary'

export default function SessionQueryProvider({ children }: { children: ReactNode }) {
  const { queryClient, revision } = useSessionBoundary()
  // Remount account-owned UI too, including draft forms and live sockets.
  return <QueryClientProvider client={queryClient} key={revision}>{children}</QueryClientProvider>
}
