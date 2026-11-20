import { Link } from 'react-router-dom'
import { EmptyState } from '@/shared/components'
import { fmt } from '../lib/labels'
import { formatVnDay } from '../lib/range'
import type { Gradebook } from '../types'

type Cell = Gradebook['rows'][number]['cells'][number]

function GradeCell({ cell }: { cell: Cell }) {
  if (cell.state === 'not_assigned') {
    return <span className="text-ink-soft" title="Không giao cho em này" />
  }
  if (cell.score === null) {
    return (
      <span
        className={cell.state === 'missing' ? 'font-extrabold text-coral' : 'text-ink-soft'}
        title={cell.state === 'missing' ? 'Quá hạn chưa nộp' : 'Chưa nộp (còn hạn)'}
      >
        –
      </span>
    )
  }
  return (
    <span className="font-extrabold">
      {cell.score}
      {cell.state === 'late' ? (
        <span title="Nộp muộn" className="ml-1 rounded bg-sunny-soft px-1 text-xs text-yellow-800">
          M
        </span>
      ) : null}
    </span>
  )
}

/** Preview of the gradebook that "Xuất bảng điểm" exports (same query). */
export function GradebookTable({ data, classId }: { data: Gradebook; classId: string }) {
  if (data.rows.length === 0) {
    return <EmptyState emoji="👧" title="Lớp chưa có học sinh" />
  }
  if (data.assignments.length === 0) {
    return <EmptyState emoji="📭" title="Chưa có bài tập nào trong khoảng thời gian này" />
  }
  return (
    <div className="overflow-x-auto rounded-2xl border-2 border-line bg-surface">
      <table className="w-full min-w-[640px] text-center text-sm">
        <thead className="bg-brand-soft text-brand-dark">
          <tr>
            <th className="sticky left-0 bg-brand-soft px-3 py-2 text-left">Học sinh</th>
            {data.assignments.map((a) => (
              <th key={a.id} className="max-w-32 px-2 py-2 align-bottom">
                <Link to={`/teacher/assignments/${a.id}`} className="line-clamp-2 hover:underline">
                  {a.title}
                </Link>
                <span className="block text-[11px] font-semibold opacity-75">hạn {formatVnDay(a.dueDate)}</span>
              </th>
            ))}
            <th className="px-2 py-2">TB (100)</th>
            <th className="px-2 py-2">TB (10)</th>
            <th className="px-2 py-2" title="Muộn / Chưa nộp">
              Muộn / Chưa
            </th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r) => (
            <tr key={r.student.id} className="border-t border-line">
              <td className="sticky left-0 bg-surface px-3 py-2 text-left font-bold">
                <Link to={`/teacher/classes/${classId}/students/${r.student.id}`} className="hover:text-brand">
                  {r.student.fullName}
                </Link>
              </td>
              {r.cells.map((c, i) => (
                <td key={data.assignments[i].id} className="px-2 py-2">
                  <GradeCell cell={c} />
                </td>
              ))}
              <td className="px-2 py-2 font-display text-base font-extrabold text-brand">{fmt(r.averageScore)}</td>
              <td className="px-2 py-2 font-bold">{fmt(r.average10)}</td>
              <td className="px-2 py-2 font-semibold">
                {r.late} / {r.notSubmitted}
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-line bg-slate-50 italic">
            <td className="sticky left-0 bg-slate-50 px-3 py-2 text-left font-bold">TB từng bài</td>
            {data.assignmentAverages.map((v, i) => (
              <td key={data.assignments[i].id} className="px-2 py-2 font-bold">
                {fmt(v)}
              </td>
            ))}
            <td colSpan={3} />
          </tr>
        </tbody>
      </table>
      <p className="px-3 py-2 text-xs font-semibold text-ink-soft">
        <span className="rounded bg-sunny-soft px-1 text-yellow-800">M</span> = nộp muộn · <b className="text-coral">–</b>{' '}
        đỏ = quá hạn chưa nộp · – xám = chưa nộp, còn hạn · ô trống = không giao · TB chỉ tính bài đã nộp
      </p>
    </div>
  )
}
