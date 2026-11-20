import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, PageHeader } from '@/shared/components'
import { formatDateTime } from '@/shared/lib/format'
import { analyticsApi } from '../api/analytics.api'
import { ExportButtons, RateBar, RatePill, SectionTitle, StatCard, StateChip } from '../components/bits'
import { QueryState } from '../components/QueryState'
import { RangeFilter } from '../components/RangeFilter'
import { TrendChart } from '../components/TrendChart'
import { useRange, useStudentReport } from '../hooks/useAnalytics'
import { fmt, SKILL_LABEL } from '../lib/labels'
import { formatRange } from '../lib/range'
import type { StudentReport } from '../types'

/** /teacher/classes/:classId/students/:studentId — one student's progress report. */
export function StudentReportPage() {
  const { classId = '', studentId = '' } = useParams()
  const navigate = useNavigate()
  const { choice, setChoice, range } = useRange()
  const report = useStudentReport(classId, studentId, range)

  return (
    <div>
      <PageHeader
        title={report.data ? `👧 ${report.data.student.fullName}` : '👧 Báo cáo học sinh'}
        subtitle={report.data ? `${report.data.class.name} · @${report.data.student.username}` : undefined}
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate(`/teacher/classes/${classId}?tab=analytics`)}>
              ← Về lớp
            </Button>
            <ExportButtons
              formats={['pdf']}
              label="Phiếu tiến độ"
              onExport={() => analyticsApi.exportStudentReport(classId, studentId, range)}
            />
          </>
        }
      />
      <Card className="mb-5 space-y-1 p-4">
        <RangeFilter value={choice} onChange={setChoice} />
        <p className="text-xs font-semibold text-ink-soft">Kỳ: {formatRange(range)}</p>
      </Card>
      <QueryState query={report} label="Đang lập báo cáo...">
        {(r) => <Report r={r} />}
      </QueryState>
    </div>
  )
}

function Report({ r }: { r: StudentReport }) {
  const hw = r.homework.counts
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon="🏅" label="Cấp độ" value={r.student.level} />
        <StatCard icon="⚡" label="Tổng XP" value={fmt(r.student.xp)} hint={`+${fmt(r.xpInRange)} XP trong kỳ`} />
        <StatCard
          icon="🗺️"
          label="Trạm đã mở"
          value={`${r.map.unlocked}/${r.map.totalStations}`}
          hint={`Đã vượt ${r.map.passed} trạm · khối ${r.student.gradeLevel}`}
        />
        <StatCard
          icon="📬"
          label="Bài tập đúng hạn"
          value={`${hw.onTime}/${hw.assigned}`}
          hint={`Muộn ${hw.late} · chưa nộp ${hw.pending + hw.missing}`}
        />
      </div>
      {r.map.current ? (
        <p className="mt-3 font-semibold text-ink-soft">
          Trạm đang chinh phục: {r.map.current.coverEmoji} <b className="text-ink">{r.map.current.title}</b>
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle>📬 Bài tập chưa hoàn thành</SectionTitle>
          {r.homework.incomplete.length === 0 ? (
            <EmptyState emoji="🎉" title="Em đã nộp hết bài tập" />
          ) : (
            <ul className="space-y-2">
              {r.homework.incomplete.map((x) => (
                <li
                  key={x.assignmentId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-line bg-surface p-3"
                >
                  <Link to={`/teacher/assignments/${x.assignmentId}`} className="font-bold hover:text-brand">
                    {x.quizTitle}
                  </Link>
                  <span className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
                    hạn {formatDateTime(x.dueDate)} <StateChip state={x.state} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <SectionTitle>📈 Điểm trung bình theo tuần</SectionTitle>
          <Card className="p-3">
            <TrendChart weeks={r.weeklyTrend} />
            <p className="text-xs font-semibold text-ink-soft">8 tuần gần nhất · vạch xanh = điểm đạt (60)</p>
          </Card>
        </section>
      </div>

      <SectionTitle>🧭 Điểm mạnh / điểm yếu</SectionTitle>
      {r.topics.length === 0 ? (
        <EmptyState emoji="🌱" title="Chưa có bài làm trong kỳ" />
      ) : (
        <Card className="space-y-3">
          <p className="text-xs font-semibold text-ink-soft">
            % đúng ở lần làm đầu tiên · vạch đen = trung bình lớp
          </p>
          {r.topics.map((t) => (
            <div key={t.topic} className="grid grid-cols-[minmax(7rem,1fr)_3fr_auto] items-center gap-3">
              <span className="font-bold">
                {t.topic}
                <span className="block text-xs font-semibold text-ink-soft">{t.answered} câu</span>
              </span>
              <RateBar rate={t.correctRate} marker={t.classRate} />
              <span className="flex items-center gap-1 text-sm">
                <RatePill rate={t.correctRate} />
                <span className="text-ink-soft">lớp {fmt(t.classRate, '%')}</span>
              </span>
            </div>
          ))}
          {r.skills.length > 0 ? (
            <div className="flex flex-wrap gap-2 border-t border-line pt-3">
              {r.skills.map((s) => (
                <Badge key={s.skill} tone="brand">
                  {SKILL_LABEL[s.skill]}: {s.correctRate}% (lớp {fmt(s.classRate, '%')})
                </Badge>
              ))}
            </div>
          ) : null}
        </Card>
      )}

      <SectionTitle>📒 Bài làm trong kỳ</SectionTitle>
      {r.history.length === 0 ? (
        <EmptyState emoji="📭" title="Chưa có bài làm trong kỳ" />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[480px] text-left">
            <tbody>
              {r.history.map((h) => (
                <tr key={h.attemptId} className="border-t border-line font-semibold first:border-t-0">
                  <td className="px-4 py-3">
                    {h.coverEmoji} {h.quizTitle} {h.homework ? <Badge tone="sky">Bài tập</Badge> : null}
                  </td>
                  <td className="px-4 py-3 font-display text-lg font-extrabold text-brand">
                    {h.score}
                    {h.passed ? <span className="ml-1 text-sm text-green-600">✓</span> : null}
                  </td>
                  <td className="px-4 py-3 text-sm">{formatDateTime(h.completedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/attempts/${h.attemptId}`} className="font-bold text-brand hover:underline">
                      Xem bài →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
