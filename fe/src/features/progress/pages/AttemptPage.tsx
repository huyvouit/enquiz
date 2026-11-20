import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '@/features/auth'
import { errorMessage } from '@/shared/api/http'
import { Button, ErrorBox, Spinner } from '@/shared/components'
import { ResultView } from '../components/ResultView'
import { useAttempt } from '../hooks/queries'
import type { AttemptResult } from '../types'

/**
 * /attempts/:attemptId — the result screen.
 * Right after submitting, the result arrives via router state (no refetch);
 * opened from history or by reload, it is fetched from the API.
 */
export function AttemptPage() {
  const { attemptId = '' } = useParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const fromState = (useLocation().state as { result?: AttemptResult } | null)?.result
  const fetched = useAttempt(attemptId, fromState)

  if (fetched.isPending) return <Spinner />
  if (fetched.error || !fetched.data) {
    return <ErrorBox message={fetched.error ? errorMessage(fetched.error) : 'Không tìm thấy bài làm'} />
  }

  const result = fetched.data
  const isStudent = user?.role === 'student'
  return (
    <ResultView
      result={result}
      actions={
        isStudent ? (
          <>
            {result.quizTitle ? (
              <Button variant="success" size="lg" onClick={() => navigate(`/play/${result.quizId}`)}>
                🔁 Chơi lại
              </Button>
            ) : null}
            <Button variant="secondary" size="lg" onClick={() => navigate('/home')}>
              🗺️ Về bản đồ
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={() => navigate(-1)}>
            ← Quay lại
          </Button>
        )
      }
      fresh={fromState?.attemptId === attemptId && isStudent}
    />
  )
}
