import { useEffect, useState, type ReactNode } from 'react'
import { useAuthStore } from '@/store/authStore'
import { refreshSession } from '@/api/refreshSession'
import LoadingState from '@/components/shared/LoadingState'

export default function AuthSessionLifecycle({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const token = useAuthStore((state) => state.token)
  const expiresAt = useAuthStore((state) => state.expiresAt)

  useEffect(() => {
    let disposed = false
    // StrictMode's double mount shares the same in-flight refresh.
    const restore = useAuthStore.getState().token ? Promise.resolve() : refreshSession()
    void restore.catch(() => {}).finally(() => { if (!disposed) setReady(true) })
    return () => { disposed = true }
  }, [])

  useEffect(() => {
    if (!token || !expiresAt) return
    let disposed = false
    let timer: ReturnType<typeof setTimeout>
    const renew = () => {
      void refreshSession().catch(() => {
        // Keep the current session through a temporary outage and retry. The
        // backend still rejects expired tokens; no expiry is extended locally.
        if (!disposed && useAuthStore.getState().token) timer = setTimeout(renew, 10_000)
      })
    }
    const remaining = Math.max(0, expiresAt - Date.now())
    timer = setTimeout(renew, Math.max(1_000, remaining - Math.min(60_000, remaining / 3)))
    return () => { disposed = true; clearTimeout(timer) }
  }, [token, expiresAt])

  return ready ? <>{children}</> : <LoadingState />
}
