import {
  Pagination,
  QuestionFiltersBar,
  QuestionPreview,
  useQuestionList,
  type Question,
} from '@/features/questions'
import { Button, EmptyState, ErrorBox, Spinner } from '@/shared/components'

/** Searchable question bank with an "add" button per question. */
export function QuestionPicker({
  selectedIds,
  onAdd,
  initialTopic,
}: {
  selectedIds: Set<string>
  onAdd: (q: Question) => void
  initialTopic?: string
}) {
  const { filters, setFilters, data, loading, error, reload } = useQuestionList({
    limit: 5,
    topic: initialTopic || undefined,
  })

  return (
    <div className="flex flex-col gap-3">
      <QuestionFiltersBar value={filters} onChange={setFilters} />
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      {loading && !data ? <Spinner /> : null}
      {data && data.items.length === 0 ? <EmptyState title="Không có câu hỏi phù hợp" /> : null}
      {data?.items.map((q) => {
        const added = selectedIds.has(q.id)
        return (
          <QuestionPreview
            key={q.id}
            question={q}
            actions={
              <Button size="sm" variant={added ? 'secondary' : 'success'} disabled={added} onClick={() => onAdd(q)}>
                {added ? '✓ Đã thêm' : '＋ Thêm'}
              </Button>
            }
          />
        )
      })}
      {data ? (
        <Pagination page={data.page} limit={data.limit} total={data.total} onPage={(page) => setFilters({ ...filters, page })} />
      ) : null}
    </div>
  )
}
