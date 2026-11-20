import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { homePathFor, useAuthStore } from '@/features/auth'
import { Button, ErrorBox, Spinner } from '@/shared/components'
import { useAsync } from '@/shared/hooks/useAsync'
import { playApi } from '../api/play.api'
import { PreviewGame } from '../components/PreviewGame'
import { StudentGame } from '../components/StudentGame'

/**
 * /play/:quizId[?assignment=<assignmentId>]
 * - Students play in a server session: every answer is graded instantly.
 *   With ?assignment= the session (and the attempt) belongs to that homework,
 *   so a homework quiz is playable even when it is not on the quest map.
 * - Teachers/admins get a preview without grading or saving.
 */
export function PlayPage() {
  const { quizId = '' } = useParams()
  const [params] = useSearchParams()
  const assignmentId = params.get('assignment') ?? undefined
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const quiz = useAsync(() => playApi.getQuiz(quizId), [quizId])

  if (quiz.loading) return <Spinner label="Đang chuẩn bị trò chơi..." />
  if (quiz.error || !quiz.data) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4">
        <ErrorBox message={quiz.error ?? 'Không tìm thấy bài'} />
        <Button
          variant="secondary"
          onClick={() => navigate(assignmentId ? '/assignments' : homePathFor(user))}
        >
          {assignmentId ? '📬 Về bài tập' : '🗺️ Về bản đồ'}
        </Button>
      </div>
    )
  }
  if (quiz.data.questions.length === 0) return <ErrorBox message="Bài này chưa có câu hỏi" />

  return user?.role === 'student' ? (
    <StudentGame key={`${quiz.data.id}:${assignmentId ?? ''}`} quiz={quiz.data} assignmentId={assignmentId} />
  ) : (
    <PreviewGame key={quiz.data.id} quiz={quiz.data} />
  )
}
