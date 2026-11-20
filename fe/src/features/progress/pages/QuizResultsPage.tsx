import { useNavigate, useParams } from 'react-router-dom'
import { errorMessage } from '@/shared/api/http'
import { Button, Card, EmptyState, ErrorBox, PageHeader, Spinner } from '@/shared/components'
import { formatDateTime } from '@/shared/lib/format'
import { useQuizResults } from '../hooks/queries'

/** /teacher/quizzes/:quizId/results — every attempt of one quiz. */
export function QuizResultsPage() {
  const { quizId = '' } = useParams()
  const navigate = useNavigate()
  const results = useQuizResults(quizId)

  const rows = results.data ?? []
  const students = new Set(rows.map((r) => r.student?.id)).size
  const average = rows.length ? Math.round(rows.reduce((sum, r) => sum + r.score, 0) / rows.length) : 0

  return (
    <div>
      <PageHeader
        title={`📊 Kết quả${rows[0]?.quizTitle ? `: ${rows[0].quizTitle}` : ''}`}
        actions={
          <Button variant="secondary" onClick={() => navigate('/teacher')}>
            ← Quay lại
          </Button>
        }
      />
      {results.isPending ? <Spinner /> : null}
      {results.error ? (
        <ErrorBox message={errorMessage(results.error)} onRetry={() => void results.refetch()} />
      ) : null}

      {results.data ? (
        <>
          <div className="mb-5 grid gap-4 sm:grid-cols-3">
            <Stat label="Lượt làm bài" value={rows.length} />
            <Stat label="Số học sinh" value={students} />
            <Stat label="Điểm trung bình" value={average} />
          </div>
          {rows.length === 0 ? (
            <EmptyState emoji="⏳" title="Chưa có học sinh nào làm bài này" />
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full min-w-[560px] text-left">
                <thead className="bg-brand-soft text-sm text-brand-dark">
                  <tr>
                    <th className="px-4 py-3">Học sinh</th>
                    <th className="px-4 py-3">Điểm</th>
                    <th className="px-4 py-3">Số câu đúng</th>
                    <th className="px-4 py-3">Thời gian nộp</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.attemptId} className="border-t border-line font-semibold">
                      <td className="px-4 py-3">
                        {r.student?.fullName}
                        <span className="block text-xs text-ink-soft">@{r.student?.username}</span>
                      </td>
                      <td className="px-4 py-3 font-display text-lg font-extrabold text-brand">
                        {r.score}
                        {r.passed ? <span className="ml-1 text-sm text-green-600">✓</span> : null}
                      </td>
                      <td className="px-4 py-3">
                        {r.correctCount}/{r.totalQuestions}
                      </td>
                      <td className="px-4 py-3 text-sm">{formatDateTime(r.completedAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/attempts/${r.attemptId}`)}>
                          Xem bài →
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      ) : null}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="text-center">
      <p className="font-display text-4xl font-extrabold text-brand">{value}</p>
      <p className="font-bold text-ink-soft">{label}</p>
    </Card>
  )
}
