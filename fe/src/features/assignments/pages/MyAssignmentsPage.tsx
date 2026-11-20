import { useState } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage } from '@/shared/api/http'
import { EmptyState, ErrorBox, PageHeader, Spinner } from '@/shared/components'
import { cn } from '@/shared/lib/cn'
import { HomeworkCard } from '../components/HomeworkCard'
import { useMyAssignments } from '../hooks/useAssignments'
import type { MyAssignment } from '../types'

type Tab = 'todo' | 'done' | 'overdue'

const TABS: { key: Tab; label: string; empty: string }[] = [
  { key: 'todo', label: '📝 Cần làm', empty: 'Em đã làm hết bài rồi, giỏi quá!' },
  { key: 'overdue', label: '⏰ Quá hạn', empty: 'Không có bài nào quá hạn' },
  { key: 'done', label: '✅ Đã nộp', empty: 'Em chưa nộp bài nào' },
]

const inTab = (a: MyAssignment, tab: Tab) =>
  tab === 'done' ? a.score !== null : tab === 'overdue' ? a.state === 'missing' : a.state === 'pending'

/** /assignments — the student's homework from every class. */
export function MyAssignmentsPage() {
  const query = useMyAssignments()
  const items = query.data ?? []
  const [picked, setPicked] = useState<Tab | null>(null)
  // Default: the first tab that has something in it.
  const tab = picked ?? TABS.find((t) => items.some((a) => inTab(a, t.key)))?.key ?? 'todo'

  const shown = items
    .filter((a) => inTab(a, tab))
    .sort((a, b) =>
      tab === 'todo'
        ? new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
        : new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime(),
    )
  const current = TABS.find((t) => t.key === tab)!

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="📬 Bài tập của em" subtitle="Bài cô giao ở các lớp của em" />

      <div className="mb-5 flex flex-wrap gap-2" role="tablist">
        {TABS.map((t) => {
          const n = items.filter((a) => inTab(a, t.key)).length
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setPicked(t.key)}
              className={cn(
                'min-h-11 rounded-2xl border-2 px-4 py-2 font-bold transition-colors',
                tab === t.key ? 'border-brand bg-brand text-white' : 'border-line bg-surface hover:border-brand',
              )}
            >
              {t.label} ({n})
            </button>
          )
        })}
      </div>

      {query.isLoading ? <Spinner /> : null}
      {query.error ? <ErrorBox message={errorMessage(query.error)} onRetry={() => void query.refetch()} /> : null}
      {query.data && items.length === 0 ? (
        <EmptyState emoji="📭" title="Em chưa có bài tập nào">
          Khi cô giao bài, bài sẽ hiện ở đây.{' '}
          <Link to="/home" className="font-bold text-brand hover:underline">
            Chơi bản đồ thử thách nhé!
          </Link>
        </EmptyState>
      ) : null}
      {items.length > 0 && shown.length === 0 ? <EmptyState emoji="🎉" title={current.empty} /> : null}

      <ul className="flex flex-col gap-3">
        {shown.map((a) => (
          <HomeworkCard key={a.id} assignment={a} />
        ))}
      </ul>
    </div>
  )
}
