import { useEffect, useRef, useState } from 'react'
import {
  FillBlankGame,
  isAnswered,
  MatchingGame,
  MultipleChoiceGame,
  OrderingGame,
  QuestionStage,
  type PlayAnswer,
  type PlayQuestion,
} from '@/features/play'
import { errorMessage } from '@/shared/api/http'
import type { MatchPair } from '@/shared/api/types'
import { Button, ErrorBox, Modal } from '@/shared/components'
import { cn } from '@/shared/lib/cn'
import { examApi } from '../api/exam.api'
import { useExamClock } from '../hooks/useExamClock'
import { toPayload, useExamDraft, type SaveState } from '../hooks/useExamDraft'
import { useLeaveGuard } from '../hooks/useLeaveGuard'
import type { ExamResult, ExamSession } from '../types'
import { Countdown } from './Countdown'
import { QuestionGrid, type GridItem } from './QuestionGrid'
import { SubmitReviewDialog } from './SubmitReviewDialog'

/**
 * The exam room (plan 4.2, doc 14): progress bar, countdown, flag for
 * review, question list, Previous/Next, review before hand-in. No answer is
 * graded until the hand-in; when time runs out the sheet is handed in.
 */
export function ExamRoom({
  session,
  onSubmitted,
}: {
  session: ExamSession
  onSubmitted: (result: ExamResult) => void
}) {
  const { questions } = session
  const exam = useExamDraft(session)
  const secondsLeft = useExamClock(session.deadlineAt, session.serverNow)
  const [gridOpen, setGridOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sending = useRef(false)
  useLeaveGuard(!done)

  const { answers, flagged, current } = exam.draft
  const question = questions[current]
  const isLast = current === questions.length - 1
  const items: GridItem[] = questions.map((q) => ({
    id: q.id,
    answered: isAnswered(q, answers[q.id]),
    flagged: flagged.includes(q.id),
  }))
  const answeredCount = items.filter((i) => i.answered).length
  const timeUp = secondsLeft === 0

  async function submit(isAutoSubmit: boolean) {
    if (sending.current) return
    sending.current = true
    setSubmitting(true)
    setError(null)
    try {
      const result = await examApi.submit(session.sessionId, {
        ...toPayload(exam.latest.current),
        isAutoSubmit,
      })
      exam.stop()
      setDone(true)
      onSubmitted(result)
    } catch (err) {
      // Offline at the deadline: the server grades the saved draft anyway.
      setError(errorMessage(err))
      sending.current = false
      setSubmitting(false)
    }
  }

  // Time is up: lock and hand in what is there (plan E1).
  useEffect(() => {
    if (timeUp && !sending.current && !done) void submit(true)
    // submit is recreated each render; timeUp is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeUp])

  function goTo(index: number) {
    setGridOpen(false)
    setReviewOpen(false)
    exam.goTo(index)
    window.scrollTo({ top: 0 })
  }

  const locked = timeUp || submitting
  const isFlagged = flagged.includes(question.id)

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b-2 border-line bg-surface/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          <div className="flex items-center gap-3">
            <p className="min-w-0 flex-1 truncate text-lg font-extrabold">
              <span aria-hidden>{session.coverEmoji} </span>
              {session.title}
            </p>
            <Countdown secondsLeft={secondsLeft} />
            {/* Phones: "Nộp bài" lives up here, far from "Câu tiếp". */}
            <Button
              variant="success"
              className="min-h-12 sm:hidden"
              disabled={locked}
              onClick={() => setReviewOpen(true)}
            >
              Nộp bài
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div
                className="h-3 overflow-hidden rounded-full bg-slate-200"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={questions.length}
                aria-valuenow={answeredCount}
                aria-label="Số câu đã làm"
              >
                <div
                  className="h-full rounded-full bg-grass transition-all"
                  style={{ width: `${(answeredCount / questions.length) * 100}%` }}
                />
              </div>
              <p className="text-sm font-bold text-ink-soft">
                Đã làm {answeredCount}/{questions.length} câu · <SaveNote state={exam.saveState} />
              </p>
            </div>
            <Button
              variant="secondary"
              className={cn('min-h-12', isFlagged && 'border-sunny bg-sunny-soft')}
              aria-pressed={isFlagged}
              aria-label={isFlagged ? 'Bỏ đánh dấu câu này' : 'Đánh dấu câu này để xem lại'}
              disabled={locked}
              onClick={() => exam.toggleFlag(question.id)}
            >
              🚩 <span className="hidden sm:inline">{isFlagged ? 'Bỏ đánh dấu' : 'Đánh dấu'}</span>
            </Button>
            <Button
              variant="secondary"
              className="min-h-12"
              aria-label="Danh sách câu"
              onClick={() => setGridOpen(true)}
            >
              ☰ <span className="hidden sm:inline">Danh sách câu</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Question stage */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-36 pt-5">
        <p className="mb-3 font-display text-xl font-extrabold text-brand">
          Câu {current + 1} / {questions.length}
          {isFlagged ? <span className="ml-2 text-base">🚩 cần xem lại</span> : null}
        </p>
        {error ? (
          <div className="mb-4 flex flex-col gap-3">
            <ErrorBox message={error} />
            <Button variant="success" className="min-h-12 w-fit" onClick={() => void submit(timeUp)}>
              Nộp lại 🔁
            </Button>
          </div>
        ) : null}
        {timeUp && !error ? (
          <p className="mb-4 rounded-2xl bg-coral-soft px-4 py-3 text-lg font-bold text-rose-900" role="alert">
            ⏰ Hết giờ! Bài của em đang được nộp...
          </p>
        ) : null}
        <QuestionStage question={question}>
          <AnswerArea
            question={question}
            value={answers[question.id]}
            disabled={locked}
            onChange={(a) => exam.setAnswer(question.id, a)}
          />
        </QuestionStage>
      </main>

      {/* Bottom navigation */}
      <nav
        aria-label="Chuyển câu"
        className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-line bg-surface/95 px-4 pt-3 backdrop-blur"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Button
            variant="secondary"
            size="lg"
            className="min-h-14 flex-1 whitespace-nowrap sm:flex-none"
            disabled={current === 0}
            onClick={() => goTo(current - 1)}
          >
            ← Câu trước
          </Button>
          <Button
            size="lg"
            className="min-h-14 flex-1 whitespace-nowrap sm:flex-none"
            disabled={locked && isLast}
            onClick={() => (isLast ? setReviewOpen(true) : goTo(current + 1))}
          >
            {isLast ? 'Xem lại bài 📋' : 'Câu tiếp →'}
          </Button>
          {/* Tablets and up; phones have it in the top bar. A wrapper, since
              Button's own inline-flex would override "hidden". */}
          <div className="ml-auto hidden sm:block">
            <Button
              variant="success"
              size="lg"
              className="min-h-14"
              disabled={locked}
              onClick={() => setReviewOpen(true)}
            >
              Nộp bài ✅
            </Button>
          </div>
        </div>
      </nav>

      <Modal open={gridOpen} title="Danh sách câu hỏi" onClose={() => setGridOpen(false)}>
        <QuestionGrid items={items} current={current} onPick={goTo} />
      </Modal>
      <SubmitReviewDialog
        open={reviewOpen && !timeUp}
        items={items}
        secondsLeft={secondsLeft}
        submitting={submitting}
        onGoTo={goTo}
        onClose={() => setReviewOpen(false)}
        onConfirm={() => void submit(false)}
      />
    </div>
  )
}

function SaveNote({ state }: { state: SaveState }) {
  if (state === 'saving') return <span>Đang lưu…</span>
  if (state === 'error') return <span className="text-rose-700">Chưa lưu được lên máy chủ, bài vẫn giữ trên máy</span>
  if (state === 'dirty') return <span>Đã ghi trên máy</span>
  return <span className="text-green-700">Đã lưu ✓</span>
}

/** The game of each type, controlled by the sheet, never graded here. */
function AnswerArea({
  question,
  value,
  disabled,
  onChange,
}: {
  question: PlayQuestion
  value: PlayAnswer | undefined
  disabled: boolean
  onChange: (answer: PlayAnswer) => void
}) {
  switch (question.type) {
    case 'multiple_choice':
      return (
        <MultipleChoiceGame
          options={question.options ?? []}
          value={typeof value === 'string' ? value : undefined}
          onChange={onChange}
          disabled={disabled}
          selectedIcon="✔️"
        />
      )
    case 'matching':
      return (
        <MatchingGame
          lefts={question.matching?.lefts ?? []}
          rights={question.matching?.rights ?? []}
          value={Array.isArray(value) ? (value as MatchPair[]) : []}
          onChange={onChange}
          disabled={disabled}
        />
      )
    case 'fill_in_blank':
      return (
        <FillBlankGame
          question={question}
          value={typeof value === 'string' ? value : ''}
          onChange={onChange}
          disabled={disabled}
        />
      )
    case 'ordering':
      return (
        <OrderingGame
          question={question}
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={onChange}
          disabled={disabled}
        />
      )
    default:
      return null
  }
}
