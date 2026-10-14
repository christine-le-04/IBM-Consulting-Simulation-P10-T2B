import React from 'react'
import ReactDOM from 'react-dom/client'
import SessionQueryProvider from '@/api/SessionQueryProvider'
import AuthSessionLifecycle from '@/api/AuthSessionLifecycle'
import App from './App'
import '@carbon/react/index.scss'
import './styles/tokens.scss'
import './styles/typography.scss'

const staleBundleReloadKey = 'consulting-sim:stale-bundle-reload-at'

function reloadForStaleBundle() {
  const previousReloadAt = Number(sessionStorage.getItem(staleBundleReloadKey) ?? '0')
  // Protect against a broken deployment loop, while allowing a later release
  // in the same browser tab to refresh normally.
  if (Date.now() - previousReloadAt < 10_000) return
  sessionStorage.setItem(staleBundleReloadKey, String(Date.now()))
  window.location.reload()
}

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  reloadForStaleBundle()
})

window.addEventListener('error', (event) => {
  const message = event.message ?? ''
  if (/Failed to fetch dynamically imported module|Loading chunk|Importing a module script failed/i.test(message)) {
    reloadForStaleBundle()
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthSessionLifecycle>
      <SessionQueryProvider>
        <App />
      </SessionQueryProvider>
    </AuthSessionLifecycle>
  </React.StrictMode>
)
