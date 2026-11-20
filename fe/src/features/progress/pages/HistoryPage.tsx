import { Link } from 'react-router-dom'
import { Badge, EmptyState, ErrorBox, PageHeader, Spinner } from '@/shared/components'
import { formatDateTime } from '@/shared/lib/format'
import { useAsync } from '@/shared/hooks/useAsync'
import { progressApi } from '../api/progress.api'
import { ScoreStars } from '../components/ScoreStars'

/** /history — a student's past attempts. */
export function HistoryPage() {
  const history = useAsync(() => progressApi.history(), [])

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="🏅 Bài đã làm" subtitle="Bấm vào một bài để xem lại đáp án" />
      {history.loading ? <Spinner /> : null}
      {history.error ? <ErrorBox message={history.error} onRetry={history.reload} /> : null}
      {history.data?.length === 0 ? (
        <EmptyState title="Em chưa làm bài nào">
          <Link to="/home" className="font-bold text-brand hover:underline">
            Bắt đầu chơi ngay!
          </Link>
        </EmptyState>
      ) : null}
      <ul className="flex flex-col gap-3">
        {history.data?.map((a) => (
          <li key={a.attemptId}>
            <Link
              to={`/attempts/${a.attemptId}`}
              className="flex items-center gap-4 rounded-2xl border-2 border-line bg-surface p-4 shadow-pop-sm transition-transform hover:-translate-y-0.5"
            >
              <span className="text-3xl" aria-hidden>
                {a.coverEmoji ?? '📘'}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{a.quizTitle ?? 'Bài quiz đã bị xoá'}</p>
                <p className="text-sm text-ink-soft">{formatDateTime(a.completedAt)}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {a.passed ? <Badge tone="grass">✓ Vượt trạm</Badge> : <Badge tone="neutral">Chưa đạt</Badge>}
                  {a.xpEarned > 0 ? <Badge tone="grape">⚡ +{a.xpEarned} XP</Badge> : null}
                </div>
              </div>
              <div className="flex flex-col items-end">
                <ScoreStars score={a.score} size="sm" />
                <span className="font-display text-xl font-extrabold text-brand">{a.score}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
