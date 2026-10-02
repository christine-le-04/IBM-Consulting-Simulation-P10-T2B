import { Component, type ErrorInfo, type ReactNode } from 'react'
import ErrorState from '@/components/shared/ErrorState'

interface Props {
  children: ReactNode
}

interface State {
  failed: boolean
}

/**
 * Catches a render failure anywhere below it so the learner gets a way back
 * instead of a blank page. Saved work lives on the server, so reloading is safe.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <ErrorState
        title="This page hit a problem"
        message="Your saved work is safe. Reload to carry on from where you were."
        actionLabel="Reload"
        onAction={() => window.location.reload()}
      />
    )
  }
}
