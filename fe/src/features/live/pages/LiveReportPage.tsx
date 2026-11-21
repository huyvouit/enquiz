import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { errorMessage } from '@/shared/api/http'
import { Badge, Button, Card, ErrorBox, PageHeader, Spinner } from '@/shared/components'
import { cn } from '@/shared/lib/cn'
import { formatDateTime } from '@/shared/lib/format'
import { liveApi, liveKeys } from '../api/live.api'
import { OPTION_BARS, OPTION_SHAPES } from '../lib/options'
import type { LiveMatchReport } from '../types'

/** /teacher/live/:matchId — report after a match (plan 5, UC4 / L12). */
export function LiveReportPage() {
  const { matchId = '' } = useParams()
  const navigate = useNavigate()
  const report = useQuery({
    queryKey: liveKeys.report(matchId),
    queryFn: () => liveApi.getReport(matchId),
    retry: 1,
  })

  if (report.isPending) return <Spinner label="Đang tải báo cáo..." />
  if (report.error) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4">
        <ErrorBox message={errorMessage(report.error)} onRetry={() => void report.refetch()} />
        <Button variant="secondary" onClick={() => navigate('/teacher/live')}>
          ← Về Đấu trường
        </Button>
      </div>
    )
  }
  const r = report.data

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={
          <>
            {r.coverEmoji} {r.quizTitle}
          </>
        }
        subtitle={
          <>
            {r.className ?? 'Phòng mở'} · {formatDateTime(r.endedAt)} · {r.settings.questionTimeSec} giây/câu
            {r.status === 'aborted' ? ' · Dừng giữa chừng' : ''}
          </>
        }
        actions={
          <Button variant="secondary" onClick={() => navigate('/teacher/live')}>
            ← Đấu trường
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon="👧" label="Người chơi" value={`${r.playerCount}`} hint={r.guestCount > 0 ? `${r.guestCount} khách` : undefined} />
        <Stat icon="❓" label="Câu đã chơi" value={`${r.questionCount}`} />
        <Stat icon="✅" label="Tỉ lệ đúng TB" value={`${r.averageCorrectRate}%`} />
        <Stat icon="🥇" label="Hạng nhất" value={r.winner ?? '–'} />
      </div>

      <section>
        <h2 className="mb-3 text-2xl font-bold">🏆 Bảng điểm</h2>
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[480px] text-left">
            <thead className="bg-brand-soft text-sm text-brand-dark">
              <tr>
                <th className="px-4 py-3">Hạng</th>
                <th className="px-4 py-3">Người chơi</th>
                <th className="px-4 py-3">Câu đúng</th>
                <th className="px-4 py-3">Điểm</th>
              </tr>
            </thead>
            <tbody>
              {r.players.map((p) => (
                <tr key={p.playerId} className="border-t border-line font-semibold">
                  <td className="px-4 py-3 font-display text-lg font-extrabold">
                    {p.rank <= 3 ? ['🥇', '🥈', '🥉'][p.rank - 1] : p.rank}
                  </td>
                  <td className="px-4 py-3">
                    {p.nickname} {p.isGuest ? <Badge tone="neutral">Khách</Badge> : null}
                  </td>
                  <td className="px-4 py-3">
                    {p.correctCount}/{r.questionCount}
                  </td>
                  <td className="px-4 py-3 font-display text-lg font-extrabold text-brand">{p.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-2xl font-bold">📋 Từng câu hỏi</h2>
        <ol className="flex flex-col gap-4">
          {r.questions.map((q, i) => (
            <QuestionCard key={q.questionId} q={q} index={i} players={r.playerCount} />
          ))}
        </ol>
      </section>
    </div>
  )
}

function Stat({ icon, label, value, hint }: { icon: string; label: string; value: string; hint?: string }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-sm font-bold text-ink-soft">
        {icon} {label}
      </span>
      <span className="truncate font-display text-2xl font-extrabold">{value}</span>
      {hint ? <span className="text-xs font-semibold text-ink-soft">{hint}</span> : null}
    </Card>
  )
}

function QuestionCard({ q, index, players }: { q: LiveMatchReport['questions'][number]; index: number; players: number }) {
  const max = Math.max(1, ...q.distribution)
  return (
    <li>
      <Card className={cn('flex flex-col gap-3', q.hardest && 'border-coral')}>
        <div className="flex flex-wrap items-start gap-2">
          <p className="min-w-0 flex-1 text-lg font-bold">
            {index + 1}. {q.questionText}
          </p>
          {q.hardest ? <Badge tone="coral">🔥 Khó nhất</Badge> : null}
          <Badge tone={q.correctRate >= 80 ? 'grass' : q.correctRate >= 50 ? 'sunny' : 'coral'}>
            {q.correctRate}% đúng
          </Badge>
          <Badge tone="sky">
            ⏱ {q.avgMs === null ? '–' : `${(q.avgMs / 1000).toFixed(1)} s`}
          </Badge>
        </div>
        <ul className="flex flex-col gap-2">
          {q.options.map((option, i) => {
            const count = q.distribution[i] ?? 0
            const right = i === q.correctIndex
            return (
              <li key={`${i}-${option}`} className="flex items-center gap-3">
                <span className="w-6 text-center" aria-hidden>
                  {right ? '✅' : OPTION_SHAPES[i % OPTION_SHAPES.length]}
                </span>
                <span className={cn('w-40 shrink-0 truncate font-semibold sm:w-56', right && 'text-green-700')}>
                  {option}
                </span>
                <div className="h-5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={cn('h-full rounded-full', OPTION_BARS[i % OPTION_BARS.length], !right && 'opacity-60')}
                    style={{ width: `${(count / max) * 100}%` }}
                  />
                </div>
                <span className="w-10 text-right font-bold tabular-nums">{count}</span>
              </li>
            )
          })}
        </ul>
        <p className="text-sm font-semibold text-ink-soft">
          {q.answeredCount}/{players} em trả lời
        </p>
      </Card>
    </li>
  )
}
