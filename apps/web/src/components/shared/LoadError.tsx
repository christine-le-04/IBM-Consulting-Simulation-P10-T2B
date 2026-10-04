import { useNavigate } from 'react-router-dom'
import { getApiProblem } from '@/api/problemDetails'
import ErrorState from '@/components/shared/ErrorState'

interface Props {
  title: string
  error: unknown
  /** What is safe, said first: "Your draft is saved." */
  reassurance?: string
  onRetry: () => void
}

/**
 * A workspace that failed to load. A refusal from the server (4xx) will not
 * change on retry, so it sends the learner back to the Office; anything else
 * is treated as a connection problem and offers another attempt.
 */
export default function LoadError({ title, error, reassurance, onRetry }: Props) {
  const navigate = useNavigate()
  const status = getApiProblem(error, '').status
  const refused = status >= 400 && status < 500
  const advice = refused
    ? 'This step is not open for this engagement right now. Go back to the Office and reopen it.'
    : 'Check your connection, then try again.'

  return (
    <ErrorState
      title={title}
      message={[reassurance, advice].filter(Boolean).join(' ')}
      actionLabel={refused ? 'Back to the Office' : 'Try again'}
      onAction={refused ? () => navigate('/dashboard') : onRetry}
    />
  )
}
