import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { invalidateAssignments } from '@/features/assignments'
import { invalidateProgress, ResultView } from '@/features/progress'
import { errorMessage } from '@/shared/api/http'
import { Button, ErrorBox, Spinner } from '@/shared/components'
import { examApi, examKeys } from '../api/exam.api'
import { ExamIntro } from '../components/ExamIntro'
import { ExamRoom } from '../components/ExamRoom'
import type { ExamResult, ExamSession } from '../types'

/**
 * /exam/:assignmentId — start screen → exam room → result (plan 4.2).
 * Outside AppLayout: no menu to tap away from during the exam.
 * An exam in progress (F5, closed tab, other device) resumes directly.
 */
export function ExamPage() {
  const { assignmentId = '' } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState<ExamSession | null>(null)
  const [result, setResult] = useState<ExamResult | null>(null)

  const intro = useQuery({
    queryKey: examKeys.intro(assignmentId),
    queryFn: () => examApi.intro(assignmentId),
    gcTime: 0,
    staleTime: Infinity,
    retry: false,
  })
  const start = useMutation({
    mutationFn: () => examApi.start(assignmentId),
    onSuccess: setSession,
  })
  const submittedId = intro.data?.state === 'submitted' ? intro.data.sessionId : null
  const past = useQuery({
    queryKey: examKeys.state(submittedId ?? ''),
    queryFn: () => examApi.get(submittedId!),
    enabled: submittedId !== null && result === null,
    gcTime: 0,
    retry: false,
  })

  const resume = intro.data?.state === 'in_progress'
  const { mutate, isIdle } = start
  useEffect(() => {
    if (resume && isIdle) mutate()
  }, [resume, isIdle, mutate])

  function submitted(r: ExamResult) {
    setResult(r)
    setSession(null)
    // Homework states, reminders, the 📬 badge and history changed.
    void invalidateAssignments()
    void invalidateProgress()
    window.scrollTo({ top: 0 })
  }

  const back = () => navigate('/assignments')
  const shown = result ?? past.data?.result ?? null

  if (shown) {
    return (
      <div className="px-4 py-8">
        <ResultView
          result={shown}
          fresh={result !== null}
          actions={
            <>
              <Button variant="secondary" className="min-h-12" onClick={back}>
                📬 Về bài tập
              </Button>
              <Button className="min-h-12" onClick={() => navigate('/home')}>
                🏠 Trang chủ
              </Button>
            </>
          }
        />
      </div>
    )
  }
  if (session) return <ExamRoom session={session} onSubmitted={submitted} />

  const error = intro.error ?? past.error
  if (error) return <Failed message={errorMessage(error)} onBack={back} />
  if (!intro.data || submittedId || (resume && !start.error)) {
    return (
      <div className="py-16">
        <Spinner label={resume ? 'Đang mở lại bài làm...' : 'Đang mở bài kiểm tra...'} />
      </div>
    )
  }
  return (
    <>
      {start.error ? (
        <div className="mx-auto max-w-2xl px-4 pt-6">
          <ErrorBox message={errorMessage(start.error)} />
        </div>
      ) : null}
      <ExamIntro intro={intro.data} starting={start.isPending} onStart={() => start.mutate()} onBack={back} />
    </>
  )
}

function Failed({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-16">
      <ErrorBox message={message} />
      <Button variant="secondary" className="min-h-12" onClick={onBack}>
        📬 Về bài tập
      </Button>
    </div>
  )
}
