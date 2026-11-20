import { Button, Card } from '@/shared/components'
import { formatDateTime } from '@/shared/lib/format'
import type { ExamIntro as Intro } from '../types'

/**
 * Start screen (plan E13): the timer starts only when the child taps
 * "Bắt đầu", so opening the homework by mistake does not use the attempt.
 */
export function ExamIntro({
  intro,
  starting,
  onStart,
  onBack,
}: {
  intro: Intro
  starting: boolean
  onStart: () => void
  onBack: () => void
}) {
  const minutes = Math.round(intro.timeLimitSec / 60)
  const msToDue = new Date(intro.dueDate).getTime() - new Date(intro.serverNow).getTime()
  // Due before the time would run out: handing in after the due date is late.
  const dueFirst = msToDue > 0 && msToDue < intro.timeLimitSec * 1000
  const overdue = msToDue <= 0
  const cannotStart = intro.closed && intro.state === 'not_started'

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-5 px-4 py-8">
      <Card className="flex flex-col items-center gap-4 text-center">
        <p className="text-6xl" aria-hidden>
          {intro.coverEmoji}
        </p>
        <p className="rounded-full bg-sky-soft px-3 py-1 text-sm font-bold text-sky-900">📝 Bài kiểm tra · {intro.className}</p>
        <h1 className="text-3xl font-extrabold">{intro.title}</h1>
        <div className="flex flex-wrap justify-center gap-3 text-lg font-bold">
          <span className="rounded-2xl bg-brand-soft px-4 py-2">❓ {intro.questionCount} câu</span>
          <span className="rounded-2xl bg-sunny-soft px-4 py-2">⏱ {minutes} phút</span>
        </div>
        <p className="font-semibold text-ink-soft">Hạn nộp: {formatDateTime(intro.dueDate)}</p>
        {intro.note ? <p className="rounded-2xl bg-grape-soft px-4 py-2 font-semibold">💬 {intro.note}</p> : null}
      </Card>

      <Card>
        <h2 className="mb-3 text-xl font-bold">Trước khi bắt đầu, em nhớ nhé:</h2>
        <ul className="flex flex-col gap-2 text-lg font-semibold">
          <li>☝️ Em chỉ được làm bài này <b>1 lần</b>.</li>
          <li>⏱ Đồng hồ chạy ngay khi em bấm Bắt đầu, và <b>vẫn chạy</b> khi em thoát ra.</li>
          <li>💾 Bài làm được lưu tự động. Lỡ tắt máy, em mở lại để làm tiếp.</li>
          <li>🔁 Em được sửa đáp án và quay lại câu trước cho tới khi nộp.</li>
          <li>
            {intro.reveal === 'after_due'
              ? '🔒 Nộp xong em biết điểm ngay; đáp án đúng hiện sau hạn nộp.'
              : '✅ Nộp xong em biết điểm và xem đáp án đúng ngay.'}
          </li>
        </ul>
        {dueFirst ? (
          <p className="mt-4 rounded-2xl bg-sunny-soft px-4 py-3 font-bold text-amber-900">
            ⚠️ Còn {Math.ceil(msToDue / 60_000)} phút là đến hạn nộp. Nộp sau giờ đó sẽ tính là nộp muộn.
          </p>
        ) : null}
        {overdue && !cannotStart ? (
          <p className="mt-4 rounded-2xl bg-coral-soft px-4 py-3 font-bold text-rose-900">
            ⚠️ Đã quá hạn nộp: bài này sẽ tính là nộp muộn.
          </p>
        ) : null}
      </Card>

      <div className="flex flex-wrap justify-between gap-4">
        <Button variant="secondary" size="lg" className="min-h-14" onClick={onBack}>
          ← Về bài tập
        </Button>
        {cannotStart ? (
          <p className="self-center font-bold text-rose-700">🔒 Cô đã đóng bài kiểm tra này.</p>
        ) : (
          <Button variant="success" size="lg" className="min-h-14" loading={starting} onClick={onStart}>
            {intro.state === 'in_progress' ? 'Làm tiếp ⏱' : 'Bắt đầu làm bài ▶'}
          </Button>
        )}
      </div>
    </div>
  )
}
