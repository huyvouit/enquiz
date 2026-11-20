import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, EmptyState, Modal } from '@/shared/components'
import { cn } from '@/shared/lib/cn'
import { BAND_STYLE, rateBand, SKILL_LABEL } from '../lib/labels'
import type { HeatCell, HeatmapQuestion, QuestionHeatmap } from '../types'
import { RatePill } from './bits'
import { HeatLegend } from './TopicHeatmapGrid'

type SortMode = 'order' | 'hardest'

const CELL: Record<Exclude<HeatCell, null>, { cls: string; icon: string; label: string }> = {
  correct: { cls: 'bg-grass-soft border-grass/50 text-green-700', icon: '✓', label: 'Đúng' },
  wrong: { cls: 'bg-coral-soft border-coral/50 text-rose-700', icon: '✗', label: 'Sai' },
  skipped: { cls: 'bg-slate-100 border-slate-300 text-slate-500', icon: '–', label: 'Bỏ trống' },
}

/**
 * Students × questions of one quiz (first attempt of each student).
 * Clicking a column header opens the question with its most common wrong answer.
 */
export function QuestionHeatmapGrid({
  data,
  classId,
  studentLink,
}: {
  data: QuestionHeatmap
  classId: string
  /** Where a student's name links to (report page). */
  studentLink?: (studentId: string) => string
}) {
  const [sort, setSort] = useState<SortMode>('order')
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  // Column order: authored order, or hardest first (lowest % correct).
  const columns = useMemo(() => {
    const idx = data.questions.map((_, i) => i)
    if (sort === 'hardest') {
      idx.sort(
        (a, b) =>
          (data.questions[a].correctRate ?? 101) - (data.questions[b].correctRate ?? 101) ||
          data.questions[a].index - data.questions[b].index,
      )
    }
    return idx
  }, [data.questions, sort])

  if (data.questions.length === 0) {
    return <EmptyState emoji="🧩" title="Quiz này chưa có câu hỏi" />
  }
  const open = openIndex === null ? null : data.questions[openIndex]
  const wrongStudents =
    openIndex === null
      ? []
      : data.rows.filter((r) => r.cells[openIndex] === 'wrong' || r.cells[openIndex] === 'skipped')

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink-soft">
          ℹ️ Chỉ tính <b>lần làm đầu tiên</b> của mỗi em: lần làm lại sau khi đã xem đáp án sẽ làm tỉ lệ đúng đẹp hơn thực
          tế. Bấm vào số câu để xem chi tiết.
        </p>
        <div className="flex gap-1" role="group" aria-label="Sắp xếp cột">
          {(
            [
              ['order', 'Thứ tự câu'],
              ['hardest', 'Khó → dễ'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={sort === value}
              onClick={() => setSort(value)}
              className={cn(
                'min-h-11 rounded-xl border-2 px-3 text-sm font-bold',
                sort === value ? 'border-brand bg-brand-soft text-brand-dark' : 'border-line text-ink-soft',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border-2 border-line bg-surface">
        <table className="border-separate border-spacing-1 p-1 text-center text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-36 bg-surface px-2 text-left text-ink-soft">Học sinh</th>
              <th className="px-1 text-ink-soft">Điểm</th>
              {columns.map((i) => {
                const q = data.questions[i]
                const style = BAND_STYLE[rateBand(q.correctRate)]
                return (
                  <th key={q.id} className="p-0">
                    <button
                      type="button"
                      onClick={() => setOpenIndex(i)}
                      title={q.questionText}
                      className={cn(
                        'flex min-h-11 w-12 flex-col items-center justify-center rounded-lg border-2 font-extrabold hover:ring-2 hover:ring-brand',
                        style.cell,
                        style.text,
                        !q.inQuiz && 'border-dashed',
                      )}
                    >
                      <span>C{q.index}</span>
                      <span className="text-[11px]">{q.correctRate === null ? '–' : `${q.correctRate}%`}</span>
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.student.id}>
                <th scope="row" className="sticky left-0 z-10 bg-surface px-2 text-left font-bold">
                  {studentLink ? (
                    <Link to={studentLink(r.student.id)} className="hover:text-brand">
                      {r.student.fullName}
                    </Link>
                  ) : (
                    r.student.fullName
                  )}
                </th>
                <td className="px-1 font-display font-extrabold text-brand">
                  {r.attemptId ? (
                    <Link to={`/attempts/${r.attemptId}`} className="hover:underline" title="Xem bài làm">
                      {r.score}
                    </Link>
                  ) : (
                    <span className="text-ink-soft" title="Chưa làm">
                      ·
                    </span>
                  )}
                </td>
                {columns.map((i) => {
                  const cell = r.cells[i]
                  if (cell === null) {
                    return <td key={i} className="size-9 rounded-lg border-2 border-dashed border-line" title="Chưa làm" />
                  }
                  const c = CELL[cell]
                  return (
                    <td
                      key={i}
                      className={cn('size-9 rounded-lg border-2 font-extrabold', c.cls)}
                      title={`${r.student.fullName} · Câu ${data.questions[i].index}: ${c.label}`}
                    >
                      {c.icon}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold text-ink-soft">
        {Object.values(CELL).map((c) => (
          <span key={c.label} className="inline-flex items-center gap-1">
            <span className={cn('inline-flex size-5 items-center justify-center rounded border-2', c.cls)}>{c.icon}</span>
            {c.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <span className="inline-block size-5 rounded border-2 border-dashed border-line" /> Chưa làm
        </span>
        <span>Cột viền đứt: câu đã bị gỡ khỏi quiz</span>
      </div>
      <HeatLegend />

      <Modal open={open !== null} title={open ? `Câu ${open.index}` : ''} onClose={() => setOpenIndex(null)}>
        {open ? (
          <QuestionDetail
            question={open}
            wrongCount={wrongStudents.length}
            assignHref={
              data.quiz && wrongStudents.length > 0
                ? `/teacher/classes/${classId}?tab=assignments&assignQuiz=${data.quiz.id}&assignStudents=${wrongStudents
                    .map((r) => r.student.id)
                    .join(',')}`
                : null
            }
            wrongNames={wrongStudents.map((r) => r.student.fullName)}
          />
        ) : null}
      </Modal>
    </div>
  )
}

function QuestionDetail({
  question: q,
  wrongCount,
  wrongNames,
  assignHref,
}: {
  question: HeatmapQuestion
  wrongCount: number
  wrongNames: string[]
  assignHref: string | null
}) {
  const navigate = useNavigate()
  return (
    <div className="space-y-4">
      <p className="rounded-2xl bg-brand-soft p-4 text-lg font-bold text-ink">{q.questionText}</p>
      <div className="flex flex-wrap gap-2 text-sm font-semibold text-ink-soft">
        <span>Chủ đề: {q.topic}</span>·<span>{SKILL_LABEL[q.skill]}</span>
        {!q.inQuiz ? <span className="text-coral">· đã gỡ khỏi quiz</span> : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border-2 border-grass/40 bg-grass-soft p-3">
          <p className="text-xs font-bold text-green-700">Đáp án đúng</p>
          <p className="font-bold">{q.correctAnswer}</p>
        </div>
        <div className="rounded-2xl border-2 border-line p-3">
          <p className="text-xs font-bold text-ink-soft">Tỉ lệ đúng</p>
          <p className="flex items-center gap-2 font-bold">
            <RatePill rate={q.correctRate} /> {q.correct}/{q.answered} em
          </p>
        </div>
      </div>
      {q.commonWrongAnswer ? (
        <div className="rounded-2xl border-2 border-coral/40 bg-coral-soft p-3">
          <p className="text-xs font-bold text-rose-700">Sai phổ biến nhất</p>
          <p className="font-bold">
            {q.commonWrongAnswer.count} em chọn “{q.commonWrongAnswer.answer}”
          </p>
        </div>
      ) : null}
      {wrongCount > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-ink-soft">
            Các em sai hoặc bỏ trống ({wrongCount}): {wrongNames.join(', ')}
          </p>
          {assignHref ? (
            <Button className="w-full" onClick={() => navigate(assignHref)}>
              🎯 Giao bài ôn cho các em sai câu này
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="font-bold text-green-700">🎉 Không em nào sai câu này.</p>
      )}
    </div>
  )
}
