import { Button, Modal } from '@/shared/components'
import { formatClock } from '../hooks/useExamClock'
import type { GridItem } from './QuestionGrid'

/**
 * "Nộp bài?" — how many questions are done, which are blank or flagged
 * (tap to go back), then the real hand-in.
 */
export function SubmitReviewDialog({
  open,
  items,
  secondsLeft,
  submitting,
  onGoTo,
  onClose,
  onConfirm,
}: {
  open: boolean
  items: GridItem[]
  secondsLeft: number
  submitting: boolean
  onGoTo: (index: number) => void
  onClose: () => void
  onConfirm: () => void
}) {
  const answered = items.filter((q) => q.answered).length
  const blank = items.flatMap((q, i) => (q.answered ? [] : [i]))
  const flagged = items.flatMap((q, i) => (q.flagged ? [i] : []))

  return (
    <Modal open={open} title="Em kiểm tra lại trước khi nộp nhé" onClose={onClose}>
      <div className="flex flex-col gap-5">
        <p className="text-xl font-bold">
          Em đã làm{' '}
          <span className={answered === items.length ? 'text-green-700' : 'text-amber-700'}>
            {answered}/{items.length}
          </span>{' '}
          câu · còn {formatClock(secondsLeft)}
        </p>

        <JumpList title="⬜ Câu chưa làm" indexes={blank} onGoTo={onGoTo} empty="Em đã làm hết các câu 🎉" />
        <JumpList title="🚩 Câu em muốn xem lại" indexes={flagged} onGoTo={onGoTo} />

        <p className="rounded-2xl bg-sunny-soft px-4 py-3 font-semibold">
          Nộp rồi thì không sửa được nữa, và em chỉ được làm bài này 1 lần.
        </p>
        <div className="flex flex-wrap justify-between gap-4">
          <Button variant="secondary" size="lg" className="min-h-14" onClick={onClose} disabled={submitting}>
            ← Làm tiếp
          </Button>
          <Button variant="success" size="lg" className="min-h-14" loading={submitting} onClick={onConfirm}>
            Nộp bài ✅
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function JumpList({
  title,
  indexes,
  onGoTo,
  empty,
}: {
  title: string
  indexes: number[]
  onGoTo: (index: number) => void
  empty?: string
}) {
  if (indexes.length === 0 && !empty) return null
  return (
    <section>
      <h3 className="mb-2 font-bold">{title}</h3>
      {indexes.length === 0 ? (
        <p className="font-semibold text-green-700">{empty}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {indexes.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => onGoTo(i)}
              className="min-h-12 min-w-12 rounded-2xl border-4 border-line bg-surface px-3 font-display text-lg font-extrabold hover:border-brand"
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
