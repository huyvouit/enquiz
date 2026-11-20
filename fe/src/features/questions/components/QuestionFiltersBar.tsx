import { GRADE_LEVELS, type QuestionType } from '@/shared/api/types'
import { Input, Select, Toggle } from '@/shared/components'
import { useAsync } from '@/shared/hooks/useAsync'
import { questionsApi } from '../api/questions.api'
import { AUTHORABLE_TYPES, QUESTION_TYPE_LABELS, type QuestionFilters } from '../types'

export function QuestionFiltersBar({
  value,
  onChange,
}: {
  value: QuestionFilters
  onChange: (next: QuestionFilters) => void
}) {
  const topics = useAsync(() => questionsApi.topics(), [])
  // Any filter change goes back to page 1.
  const patch = (p: Partial<QuestionFilters>) => onChange({ ...value, ...p, page: 1 })

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="search"
        placeholder="🔍 Tìm câu hỏi..."
        value={value.search ?? ''}
        onChange={(e) => patch({ search: e.target.value })}
        className="min-w-48 flex-1"
      />
      <Select
        aria-label="Chủ đề"
        value={value.topic ?? ''}
        onChange={(e) => patch({ topic: e.target.value || undefined })}
        className="w-auto!"
      >
        <option value="">Mọi chủ đề</option>
        {topics.data?.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Khối lớp"
        value={value.gradeLevel ?? ''}
        onChange={(e) => patch({ gradeLevel: e.target.value ? Number(e.target.value) : undefined })}
        className="w-auto!"
      >
        <option value="">Mọi lớp</option>
        {GRADE_LEVELS.map((g) => (
          <option key={g} value={g}>
            Lớp {g}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Dạng câu hỏi"
        value={value.type ?? ''}
        onChange={(e) => patch({ type: (e.target.value || undefined) as QuestionType | undefined })}
        className="w-auto!"
      >
        <option value="">Mọi dạng</option>
        {AUTHORABLE_TYPES.map((t) => (
          <option key={t} value={t}>
            {QUESTION_TYPE_LABELS[t]}
          </option>
        ))}
      </Select>
      <Toggle checked={!!value.mine} onChange={(mine) => patch({ mine })} label="Của tôi" />
    </div>
  )
}
