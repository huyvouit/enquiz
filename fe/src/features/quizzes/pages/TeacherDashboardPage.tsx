import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AssignDialog } from '@/features/assignments'
import { useAuthStore } from '@/features/auth'
import { errorMessage } from '@/shared/api/http'
import { Button, EmptyState, ErrorBox, Mascot, PageHeader, Spinner } from '@/shared/components'
import { cn } from '@/shared/lib/cn'
import { quizzesApi } from '../api/quizzes.api'
import { QuizCard } from '../components/QuizCard'
import { invalidateQuizzes, useQuizList } from '../hooks/queries'
import type { QuizSummary } from '../types'

type Tab = 'mine' | 'all'

export function TeacherDashboardPage() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('mine')
  const [assigning, setAssigning] = useState<QuizSummary | null>(null)
  const quizzes = useQuizList(tab === 'mine')

  const canModify = (q: QuizSummary) => user?.role === 'admin' || q.author?.id === user?.id

  async function remove(q: QuizSummary) {
    if (!window.confirm(`Xoá bài quiz "${q.title}"? Lịch sử làm bài của học sinh vẫn được giữ lại.`)) return
    try {
      await quizzesApi.remove(q.id)
      void invalidateQuizzes()
    } catch (err) {
      window.alert(errorMessage(err))
    }
  }

  return (
    <div>
      <PageHeader
        title={`Xin chào, ${user?.fullName ?? ''} 👋`}
        subtitle="Quản lý bài quiz cho học sinh"
        actions={
          <Link to="/teacher/quizzes/new">
            <Button variant="success">＋ Tạo quiz mới</Button>
          </Link>
        }
      />

      <div className="mb-5 inline-flex rounded-2xl border-2 border-line bg-surface p-1" role="tablist">
        {(
          [
            ['mine', 'Quiz của tôi'],
            ['all', 'Tất cả quiz'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              'rounded-xl px-4 py-2 font-bold transition-colors',
              tab === value ? 'bg-brand text-white' : 'text-ink-soft hover:text-ink',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {quizzes.error ? (
        <ErrorBox message={errorMessage(quizzes.error)} onRetry={() => void quizzes.refetch()} />
      ) : null}
      {quizzes.isPending ? <Spinner /> : null}
      {quizzes.data?.length === 0 ? (
        <div className="flex flex-col items-center gap-4">
          <Mascot mood="thinking" message="Cô/thầy chưa có bài quiz nào. Tạo bài đầu tiên nhé!" />
          <EmptyState emoji="🧩" title="Chưa có bài quiz">
            <Link to="/teacher/quizzes/new" className="font-bold text-brand hover:underline">
              Tạo quiz mới
            </Link>
          </EmptyState>
        </div>
      ) : null}

      {!quizzes.isPending ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {quizzes.data?.map((q) => (
            <QuizCard
              key={q.id}
              quiz={q}
              actions={
                <>
                  <Button size="sm" variant="secondary" onClick={() => navigate(`/play/${q.id}`)}>
                    👀 Chơi thử
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setAssigning(q)}>
                    📬 Giao cho lớp…
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => navigate(`/teacher/live/new?quizId=${q.id}`)}>
                    ⚔️ Đấu trường
                  </Button>
                  {canModify(q) ? (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => navigate(`/teacher/quizzes/${q.id}/results`)}>
                        📊 Kết quả
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => navigate(`/teacher/quizzes/${q.id}/edit`)}>
                        ✏️ Sửa
                      </Button>
                      <Button size="sm" variant="ghost" className="text-coral" aria-label="Xoá" onClick={() => remove(q)}>
                        🗑️
                      </Button>
                    </>
                  ) : null}
                </>
              }
            />
          ))}
        </div>
      ) : null}
      <AssignDialog
        open={assigning !== null}
        quiz={assigning ? { id: assigning.id, title: assigning.title } : undefined}
        onClose={() => setAssigning(null)}
      />
    </div>
  )
}
