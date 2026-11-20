import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/features/auth'
import { errorMessage } from '@/shared/api/http'
import { Button, EmptyState, ErrorBox, PageHeader, Spinner } from '@/shared/components'
import { questionsApi } from '../api/questions.api'
import { Pagination } from '../components/Pagination'
import { QuestionFiltersBar } from '../components/QuestionFiltersBar'
import { QuestionPreview } from '../components/QuestionPreview'
import { useQuestionList } from '../hooks/useQuestionList'
import type { Question } from '../types'

export function QuestionBankPage() {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()
  const { filters, setFilters, data, loading, error, reload } = useQuestionList()

  const canModify = (q: Question) => user?.role === 'admin' || q.createdBy === user?.id

  async function remove(q: Question) {
    if (!window.confirm(`Xoá câu hỏi "${q.questionText}"?`)) return
    try {
      await questionsApi.remove(q.id)
      reload()
    } catch (err) {
      window.alert(errorMessage(err))
    }
  }

  return (
    <div>
      <PageHeader
        title="📚 Kho câu hỏi"
        subtitle="Câu hỏi dùng chung để ghép thành bài quiz"
        actions={
          <>
            <Link to="/teacher/questions/import">
              <Button variant="secondary">📥 Nhập từ CSV</Button>
            </Link>
            <Link to="/teacher/questions/new">
              <Button variant="success">＋ Câu hỏi mới</Button>
            </Link>
          </>
        }
      />
      <div className="mb-5">
        <QuestionFiltersBar value={filters} onChange={setFilters} />
      </div>

      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      {loading && !data ? <Spinner /> : null}
      {data && data.items.length === 0 ? (
        <EmptyState title="Chưa có câu hỏi nào khớp bộ lọc">Hãy thử bỏ bớt bộ lọc hoặc tạo câu hỏi mới.</EmptyState>
      ) : null}

      <div className="flex flex-col gap-3">
        {data?.items.map((q) => (
          <QuestionPreview
            key={q.id}
            question={q}
            actions={
              canModify(q) ? (
                <>
                  <Button size="sm" variant="secondary" onClick={() => navigate(`/teacher/questions/${q.id}/edit`)}>
                    ✏️ Sửa
                  </Button>
                  <Button size="sm" variant="ghost" className="text-coral" onClick={() => remove(q)}>
                    🗑️
                  </Button>
                </>
              ) : null
            }
          />
        ))}
      </div>

      {data ? (
        <div className="mt-6">
          <Pagination
            page={data.page}
            limit={data.limit}
            total={data.total}
            onPage={(page) => setFilters({ ...filters, page })}
          />
        </div>
      ) : null}
    </div>
  )
}
