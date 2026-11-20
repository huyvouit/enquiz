import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button, Card, EmptyState, PageHeader } from '@/shared/components'
import { formatDateTime } from '@/shared/lib/format'
import { analyticsApi } from '../api/analytics.api'
import { ExportButtons, SectionTitle, StatCard, StateChip } from '../components/bits'
import { QueryState } from '../components/QueryState'
import { QuestionHeatmapGrid } from '../components/QuestionHeatmapGrid'
import { useAssignmentDetail, useAssignmentHeatmap } from '../hooks/useAnalytics'
import { fmt } from '../lib/labels'
import type { AssignmentDetail } from '../types'

const TARGET_LABEL = { class: 'Cả lớp', group: 'Nhóm', students: 'Một số học sinh' } as const

/** /teacher/assignments/:assignmentId — submissions + question heatmap of one homework. */
export function AssignmentReportPage() {
  const { assignmentId = '' } = useParams()
  const navigate = useNavigate()
  const detail = useAssignmentDetail(assignmentId)
  const heatmap = useAssignmentHeatmap(assignmentId)

  return (
    <div>
      <QueryState query={detail} label="Đang tải bài tập...">
        {(a) => (
          <>
            <PageHeader
              title={
                <>
                  {a.quiz?.coverEmoji ?? '📘'} {a.quiz?.title ?? '(quiz đã xoá)'}
                </>
              }
              subtitle={
                <>
                  {a.className} · {a.target.kind === 'group' ? `Nhóm ${a.target.groupName ?? ''}` : TARGET_LABEL[a.target.kind]}{' '}
                  · Hạn nộp {formatDateTime(a.dueDate)}
                  {a.status === 'closed' ? ' · 🔒 Đã đóng' : ''}
                </>
              }
              actions={
                <>
                  <Button variant="secondary" onClick={() => navigate(`/teacher/classes/${a.classId}?tab=assignments`)}>
                    ← Về lớp
                  </Button>
                  <ExportButtons onExport={(format) => analyticsApi.exportAssignment(assignmentId, format)} />
                </>
              }
            />
            {a.note ? <p className="mb-4 rounded-2xl bg-sunny-soft p-3 font-semibold">💬 {a.note}</p> : null}
            <Summary a={a} />
            <SectionTitle>📋 Nộp bài</SectionTitle>
            <Submissions a={a} />
          </>
        )}
      </QueryState>

      <SectionTitle>🌡️ Bản đồ nhiệt câu hỏi</SectionTitle>
      <QueryState query={heatmap} label="Đang tính tỉ lệ đúng...">
        {(h) =>
          detail.data ? (
            <QuestionHeatmapGrid
              data={h}
              classId={detail.data.classId}
              studentLink={(id) => `/teacher/classes/${detail.data.classId}/students/${id}`}
            />
          ) : null
        }
      </QueryState>
    </div>
  )
}

function Summary({ a }: { a: AssignmentDetail }) {
  const c = a.counts
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <StatCard icon="✅" label="Đúng hạn" value={`${c.onTime}/${c.assigned}`} />
      <StatCard icon="🕒" label="Nộp muộn" value={c.late} />
      <StatCard icon="⏳" label="Chưa nộp (còn hạn)" value={c.pending} />
      <StatCard icon="❌" label="Quá hạn chưa nộp" value={c.missing} />
      <StatCard icon="⭐" label="Điểm TB" value={fmt(a.averageScore)} hint="Chỉ tính bài đã nộp" />
    </div>
  )
}

function Submissions({ a }: { a: AssignmentDetail }) {
  if (a.submissions.length === 0) return <EmptyState emoji="👧" title="Bài tập này chưa giao cho em nào" />
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[600px] text-left">
        <thead className="bg-brand-soft text-sm text-brand-dark">
          <tr>
            <th className="px-4 py-3">Học sinh</th>
            <th className="px-4 py-3">Trạng thái</th>
            <th className="px-4 py-3">Điểm</th>
            <th className="px-4 py-3">Nộp lúc</th>
            <th className="px-4 py-3">Số lần</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {a.submissions.map((s) => (
            <tr key={s.student.id} className="border-t border-line font-semibold">
              <td className="px-4 py-3">
                <Link to={`/teacher/classes/${a.classId}/students/${s.student.id}`} className="hover:text-brand">
                  {s.student.fullName}
                </Link>
                <span className="block text-xs text-ink-soft">@{s.student.username}</span>
              </td>
              <td className="px-4 py-3">
                <StateChip state={s.state} />
              </td>
              <td className="px-4 py-3 font-display text-lg font-extrabold text-brand">{fmt(s.score)}</td>
              <td className="px-4 py-3 text-sm">{s.submittedAt ? formatDateTime(s.submittedAt) : '–'}</td>
              <td className="px-4 py-3">{s.attempts}</td>
              <td className="px-4 py-3 text-right">
                {s.attemptId ? (
                  <Link to={`/attempts/${s.attemptId}`} className="font-bold text-brand hover:underline">
                    Xem bài →
                  </Link>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
