import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { ClassTabProps } from '@/features/classes'
import { Badge, Card, EmptyState } from '@/shared/components'
import { cn } from '@/shared/lib/cn'
import { analyticsApi } from '../api/analytics.api'
import { useGradebook, useOverview, useRange, useTopicHeatmap } from '../hooks/useAnalytics'
import { fmt, SKILL_LABEL } from '../lib/labels'
import { formatRange, formatVnDay } from '../lib/range'
import type { ClassOverview } from '../types'
import { ExportButtons, RatePill, SectionTitle, StatCard } from './bits'
import { GradebookTable } from './GradebookTable'
import { QueryState } from './QueryState'
import { RangeFilter } from './RangeFilter'
import { TopicHeatmapGrid } from './TopicHeatmapGrid'

type Section = 'overview' | 'topics' | 'gradebook' | 'students'

const SECTIONS: { value: Section; label: string }[] = [
  { value: 'overview', label: '📊 Tổng quan' },
  { value: 'topics', label: '🌡️ Bản đồ nhiệt chủ đề' },
  { value: 'gradebook', label: '📒 Bảng điểm' },
  { value: 'students', label: '👧 Học sinh' },
]

/** "Thống kê" tab of the class page (plan 3.3). */
export function ClassAnalyticsTab({ classDetail }: ClassTabProps) {
  const classId = classDetail.id
  const { choice, setChoice, range } = useRange()
  const [section, setSection] = useState<Section>('overview')

  return (
    <div>
      <Card className="mb-5 flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="space-y-1">
          <RangeFilter value={choice} onChange={setChoice} />
          <p className="text-xs font-semibold text-ink-soft">Kỳ: {formatRange(range)}</p>
        </div>
        <ExportButtons
          label="Xuất bảng điểm"
          onExport={(format) => analyticsApi.exportGradebook(classId, range, format)}
        />
      </Card>

      <div className="mb-4 flex gap-1 overflow-x-auto" role="tablist" aria-label="Mục thống kê">
        {SECTIONS.map((s) => (
          <button
            key={s.value}
            type="button"
            role="tab"
            aria-selected={section === s.value}
            onClick={() => setSection(s.value)}
            className={cn(
              'min-h-11 whitespace-nowrap rounded-xl px-3 py-2 font-bold',
              section === s.value ? 'bg-brand text-white' : 'bg-surface text-ink-soft hover:text-ink',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === 'overview' ? <OverviewSection classId={classId} range={range} /> : null}
      {section === 'topics' ? <TopicsSection classId={classId} range={range} /> : null}
      {section === 'gradebook' ? <GradebookSection classId={classId} range={range} /> : null}
      {section === 'students' ? (
        classDetail.students.length === 0 ? (
          <EmptyState emoji="👧" title="Lớp chưa có học sinh" />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {classDetail.students.map((s) => (
              <Link
                key={s.id}
                to={`/teacher/classes/${classId}/students/${s.id}`}
                className="flex min-h-11 items-center justify-between rounded-2xl border-2 border-line bg-surface px-4 py-3 font-bold hover:border-brand"
              >
                <span>{s.fullName}</span>
                <span className="text-sm text-ink-soft">
                  Cấp {s.level} · {fmt(s.xp)} XP →
                </span>
              </Link>
            ))}
          </div>
        )
      ) : null}
    </div>
  )
}

type RangeProps = { classId: string; range: { from: string; to: string } }

function OverviewSection({ classId, range }: RangeProps) {
  const query = useOverview(classId, range)
  return <QueryState query={query}>{(o) => <Overview data={o} classId={classId} />}</QueryState>
}

function Overview({ data: o, classId }: { data: ClassOverview; classId: string }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard icon="👧" label="Sĩ số" value={o.studentCount} />
        <StatCard icon="🔥" label="Hoạt động 7 ngày" value={`${o.activeLast7Days}/${o.studentCount}`} />
        <StatCard icon="⭐" label="Điểm TB" value={fmt(o.averageScore)} hint={`${fmt(o.attempts)} lượt làm trong kỳ`} />
        <StatCard
          icon="✅"
          label="Nộp đúng hạn"
          value={fmt(o.onTimeRate, '%')}
          hint="Các bài đã hết hạn trong kỳ"
        />
        <StatCard icon="📬" label="Bài đang mở" value={o.openAssignments} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section>
          <SectionTitle>🚩 Cần chú ý</SectionTitle>
          {o.needsAttention.length === 0 ? (
            <EmptyState emoji="🌟" title="Cả lớp đang học tốt!" />
          ) : (
            <ul className="space-y-2">
              {o.needsAttention.map((a) => (
                <li key={a.student.id}>
                  <Link
                    to={`/teacher/classes/${classId}/students/${a.student.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-line bg-surface p-3 hover:border-brand"
                  >
                    <span className="font-bold">{a.student.fullName}</span>
                    <span className="flex flex-wrap gap-1">
                      {a.reasons.map((r) => (
                        <Badge key={r} tone="coral">
                          {r}
                        </Badge>
                      ))}
                    </span>
                    <span className="w-full text-xs font-semibold text-ink-soft">
                      Lần cuối làm bài: {a.lastActiveAt ? formatVnDay(a.lastActiveAt) : 'chưa có'} · Xem báo cáo →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <SectionTitle>🧭 Chủ đề cần giảng lại</SectionTitle>
          {o.weakTopics.length === 0 ? (
            <EmptyState emoji="📈" title="Chưa đủ dữ liệu để kết luận" />
          ) : (
            <ul className="space-y-2">
              {o.weakTopics.map((t) => (
                <li
                  key={`${t.topic}-${t.skill}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border-2 border-line bg-surface p-3"
                >
                  <span>
                    <span className="font-bold">{t.topic}</span>{' '}
                    <span className="text-sm text-ink-soft">· {SKILL_LABEL[t.skill]}</span>
                    <span className="block text-xs text-ink-soft">{t.answered} câu trả lời</span>
                  </span>
                  <RatePill rate={t.correctRate} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function TopicsSection({ classId, range }: RangeProps) {
  const query = useTopicHeatmap(classId, range)
  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-ink-soft">
        Tỉ lệ đúng theo chủ đề và kỹ năng, chỉ tính lần làm đầu tiên của mỗi em với mỗi bài.
      </p>
      <QueryState query={query}>{(d) => <TopicHeatmapGrid data={d} />}</QueryState>
    </div>
  )
}

function GradebookSection({ classId, range }: RangeProps) {
  const query = useGradebook(classId, range)
  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-ink-soft">
        Bài tập có hạn từ đầu kỳ và đã giao trước khi kỳ kết thúc. File Excel/PDF xuất ra đúng bảng này.
      </p>
      <QueryState query={query}>{(d) => <GradebookTable data={d} classId={classId} />}</QueryState>
    </div>
  )
}
