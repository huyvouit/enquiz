import { useState } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'
import { formatDateTime } from '@/shared/lib/format'
import { useNow } from '../hooks/useNow'
import { STATE_META, STATE_ORDER } from '../lib/states'
import type { AssignmentDetail, SubmissionState } from '../types'
import { StateChip } from './StateParts'

/** Who submitted a homework, when and with which score. Filterable by state. */
export function SubmissionTable({ detail }: { detail: AssignmentDetail }) {
  const [filter, setFilter] = useState<SubmissionState | 'all'>('all')
  const rows = detail.submissions.filter((r) => filter === 'all' || r.state === filter)
  const count = (s: SubmissionState) => detail.submissions.filter((r) => r.state === s).length
  const now = useNow(15_000)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Lọc theo trạng thái">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
          Tất cả ({detail.submissions.length})
        </FilterChip>
        {STATE_ORDER.map((s) => (
          <FilterChip key={s} active={filter === s} onClick={() => setFilter(s)}>
            {STATE_META[s].icon} {STATE_META[s].label} ({count(s)})
          </FilterChip>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border-2 border-line bg-surface">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-brand-soft/60 text-xs uppercase text-ink-soft">
            <tr>
              <th className="px-3 py-2">Học sinh</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2 text-right">Điểm</th>
              <th className="px-3 py-2">Nộp lúc</th>
              <th className="px-3 py-2 text-right">Số lần</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.student.id} className="border-t border-line">
                <td className="px-3 py-2">
                  <div className="font-bold">{r.student.fullName}</div>
                  <div className="text-xs text-ink-soft">{r.student.username}</div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StateChip state={r.state} />
                    {r.inProgress ? (
                      <span className="rounded-full bg-sky-soft px-2 py-0.5 text-xs font-bold text-sky-800">
                        ✍️ Đang làm · còn {minutesLeft(r.inProgress.deadlineAt, now)} phút
                      </span>
                    ) : null}
                    {r.isAutoSubmit ? (
                      <span
                        className="rounded-full bg-sunny-soft px-2 py-0.5 text-xs font-bold text-yellow-800"
                        title="Hết giờ, hệ thống đã tự nộp bài"
                      >
                        ⏱ Tự nộp
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-2 text-right font-display text-lg font-bold">{r.score ?? '–'}</td>
                <td className="px-3 py-2">{r.submittedAt ? formatDateTime(r.submittedAt) : '–'}</td>
                <td className="px-3 py-2 text-right">{r.attempts}</td>
                <td className="px-3 py-2 text-right">
                  {r.attemptId ? (
                    <Link to={`/attempts/${r.attemptId}`} className="font-bold text-brand hover:underline">
                      Xem bài
                    </Link>
                  ) : null}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-ink-soft">
                  Không có học sinh nào ở trạng thái này
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Whole minutes left before an exam's deadline, never negative. */
function minutesLeft(deadlineAt: string, now: number): number {
  return Math.max(0, Math.ceil((new Date(deadlineAt).getTime() - now) / 60_000))
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-full border-2 px-3 py-1 text-sm font-bold transition-colors',
        active ? 'border-brand bg-brand-soft text-brand-dark' : 'border-line bg-surface text-ink-soft hover:border-brand',
      )}
    >
      {children}
    </button>
  )
}
