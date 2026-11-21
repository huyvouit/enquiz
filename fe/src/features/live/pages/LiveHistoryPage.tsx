import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { errorMessage } from '@/shared/api/http'
import { Badge, Button, Card, EmptyState, ErrorBox, PageHeader, Spinner } from '@/shared/components'
import { formatDateTime } from '@/shared/lib/format'
import { liveApi, liveKeys } from '../api/live.api'

/** /teacher/live — the teacher's past matches (plan 5, UC4). */
export function LiveHistoryPage() {
  const navigate = useNavigate()
  const matches = useQuery({ queryKey: liveKeys.matches(), queryFn: () => liveApi.listMatches() })

  return (
    <div>
      <PageHeader
        title="⚔️ Đấu trường"
        subtitle="Trận đấu trực tiếp trên màn chiếu: học sinh vào bằng mã PIN, trả lời trên máy của mình."
        actions={
          <Button onClick={() => navigate('/teacher/live/new')} size="lg">
            ⚔️ Mở phòng mới
          </Button>
        }
      />
      {matches.isPending ? (
        <Spinner />
      ) : matches.error ? (
        <ErrorBox message={errorMessage(matches.error)} onRetry={() => void matches.refetch()} />
      ) : matches.data.length === 0 ? (
        <EmptyState emoji="⚔️" title="Chưa có trận đấu nào">
          Bấm “Mở phòng mới”, chọn một bài quiz có câu trắc nghiệm rồi chiếu mã PIN cho cả lớp.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {matches.data.map((m) => (
            <li key={m.id}>
              <Link to={`/teacher/live/${m.id}`} className="block">
                <Card className="flex flex-wrap items-center gap-4 transition-colors hover:border-brand">
                  <span className="text-4xl" aria-hidden>
                    {m.coverEmoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-lg font-bold">
                      {m.quizTitle}
                      {m.status === 'aborted' ? <Badge tone="sunny">Dừng giữa chừng</Badge> : null}
                    </p>
                    <p className="text-sm font-semibold text-ink-soft">
                      {m.className ?? 'Phòng mở'} · {formatDateTime(m.endedAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-sm font-bold">
                    <Badge tone="brand">
                      👧 {m.playerCount} người{m.guestCount > 0 ? ` (${m.guestCount} khách)` : ''}
                    </Badge>
                    <Badge tone="sky">❓ {m.questionCount} câu</Badge>
                    <Badge tone={m.averageCorrectRate >= 80 ? 'grass' : m.averageCorrectRate >= 50 ? 'sunny' : 'coral'}>
                      ✅ {m.averageCorrectRate}% đúng
                    </Badge>
                    {m.winner ? <Badge tone="grape">🥇 {m.winner}</Badge> : null}
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
