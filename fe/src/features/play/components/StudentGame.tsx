import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { invalidateAssignments } from '@/features/assignments'
import { useAuthStore } from '@/features/auth'
import { progressApi, type AnswerFeedback, type SessionView } from '@/features/progress'
import { errorMessage } from '@/shared/api/http'
import type { MatchPair } from '@/shared/api/types'
import { Button, ErrorBox, Spinner } from '@/shared/components'
import { useAsync } from '@/shared/hooks/useAsync'
import { playApi } from '../api/play.api'
import { playSfx } from '@/shared/sound'
import { isAnswered } from '../lib/answers'
import type { PlayQuiz } from '../types'
import { FeedbackBanner } from './FeedbackBanner'
import { MatchingGame } from './MatchingGame'
import { MultipleChoiceGame } from './MultipleChoiceGame'
import { PlayTopBar } from './PlayTopBar'
import { QuestionStage } from './QuestionStage'

/**
 * Opens (or resumes) the server session, then runs the game.
 * `assignmentId`: play the quiz as that homework (plan 3.2).
 */
export function StudentGame({ quiz, assignmentId }: { quiz: PlayQuiz; assignmentId?: string }) {
  const navigate = useNavigate()
  const session = useAsync(() => playApi.startSession(quiz.id, assignmentId), [quiz.id, assignmentId])
  if (session.loading) return <Spinner label={assignmentId ? 'Đang mở bài tập...' : 'Đang vào trạm...'} />
  if (session.error || !session.data) {
    // e.g. 409 "Cô đã đóng bài tập này rồi em nhé" or 404 when not assigned.
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4">
        <ErrorBox message={session.error ?? 'Không mở được bài'} />
        <Button variant="secondary" onClick={() => navigate(assignmentId ? '/assignments' : '/home')}>
          {assignmentId ? '📬 Về bài tập' : '🗺️ Về bản đồ'}
        </Button>
      </div>
    )
  }
  return <Game key={session.data.sessionId} quiz={quiz} session={session.data} assignmentId={assignmentId} />
}

function Game({
  quiz,
  session,
  assignmentId,
}: {
  quiz: PlayQuiz
  session: SessionView
  assignmentId?: string
}) {
  const navigate = useNavigate()
  const { questions } = quiz
  const [feedback, setFeedback] = useState<Record<string, AnswerFeedback>>(() =>
    Object.fromEntries(session.answers.map((a) => [a.questionId, a])),
  )
  // Resume at the first question not answered yet.
  const [index, setIndex] = useState(() => {
    const i = questions.findIndex((q) => !session.answers.some((a) => a.questionId === q.id))
    return i === -1 ? questions.length - 1 : i
  })
  const [matchDraft, setMatchDraft] = useState<Record<string, MatchPair[]>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const question = questions[index]
  const fb = feedback[question.id]
  const isLast = index === questions.length - 1
  const answeredCount = questions.filter((q) => feedback[q.id]).length
  const correctCount = questions.filter((q) => feedback[q.id]?.isCorrect).length

  // Consecutive correct answers ending at the latest answered question.
  let streak = 0
  for (let i = index; i >= 0; i--) {
    const f = feedback[questions[i].id]
    if (!f) continue
    if (!f.isCorrect) break
    streak++
  }

  async function send(answer: string | string[] | MatchPair[]) {
    if (busy || fb) return
    setBusy(true)
    setError(null)
    try {
      const res = await progressApi.answer(session.sessionId, question.id, answer)
      setFeedback((prev) => ({ ...prev, [question.id]: res }))
      playSfx(res.isCorrect ? 'correct' : 'wrong')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function finish() {
    setBusy(true)
    setError(null)
    try {
      const result = await progressApi.finish(session.sessionId)
      // Level/XP in the header come from the profile.
      void useAuthStore.getState().refreshProfile().catch(() => {})
      // Homework states, reminders and the 📬 badge changed.
      void invalidateAssignments()
      navigate(`/attempts/${result.attemptId}`, { replace: true, state: { result } })
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  function quit() {
    if (window.confirm('Em muốn dừng lại? Bài làm được giữ trong 24 giờ để chơi tiếp.')) {
      navigate(assignmentId ? '/assignments' : '/home')
    }
  }

  const mcValue = fb ? (fb.studentAnswer as string) : undefined
  const matchValue = fb ? ((fb.studentAnswer as MatchPair[]) ?? []) : (matchDraft[question.id] ?? [])

  return (
    <div className="mx-auto max-w-3xl">
      {assignmentId ? (
        <div className="mb-3 w-fit rounded-full bg-grape-soft px-3 py-1 text-sm font-bold text-purple-800">
          📬 Bài tập về nhà
        </div>
      ) : null}
      <PlayTopBar
        done={answeredCount}
        total={questions.length}
        correct={correctCount}
        streak={fb?.isCorrect ? streak : 0}
        onQuit={quit}
      />

      <QuestionStage question={question} feedback={fb ?? undefined} busy={busy} onSubmit={(a) => void send(a)}>
        {question.type === 'multiple_choice' && question.options ? (
          <MultipleChoiceGame
            options={question.options}
            value={mcValue}
            disabled={busy}
            correctAnswer={fb ? String(fb.correctAnswer) : undefined}
            onChange={(option) => void send(option)}
          />
        ) : null}

        {question.type === 'matching' && question.matching ? (
          <MatchingGame
            lefts={question.matching.lefts}
            rights={question.matching.rights}
            value={matchValue}
            disabled={busy}
            correctPairs={fb ? (fb.correctAnswer as MatchPair[]) : undefined}
            onChange={(pairs) => setMatchDraft((d) => ({ ...d, [question.id]: pairs }))}
          />
        ) : null}

        {fb ? <FeedbackBanner feedback={fb} seed={index} /> : null}
      </QuestionStage>

      {error ? (
        <div className="mt-4">
          <ErrorBox message={error} />
        </div>
      ) : null}

      <div className="mt-8 flex items-center justify-between gap-4">
        <Button variant="secondary" size="lg" disabled={index === 0 || busy} onClick={() => setIndex(index - 1)}>
          ← Xem lại
        </Button>

        {!fb && question.type === 'matching' ? (
          <Button
            size="lg"
            variant="success"
            loading={busy}
            disabled={!isAnswered(question, matchValue)}
            onClick={() => void send(matchValue)}
          >
            Kiểm tra ✔
          </Button>
        ) : null}

        {fb && !isLast ? (
          <Button size="lg" onClick={() => setIndex(index + 1)}>
            Câu tiếp theo →
          </Button>
        ) : null}
        {fb && isLast ? (
          <Button size="lg" variant="success" loading={busy} onClick={() => void finish()}>
            Xem kết quả 🏁
          </Button>
        ) : null}
      </div>
    </div>
  )
}
