import { useEffect, useState } from 'react'
import { useAsync } from '@/shared/hooks/useAsync'
import { questionsApi } from '../api/questions.api'
import type { QuestionFilters } from '../types'

/** Debounces the free-text search so typing does not fire a request per key. */
function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return debounced
}

/** Filter state + paged question list. Shared by the bank page and quiz builder. */
export function useQuestionList(initial: QuestionFilters = {}) {
  const [filters, setFilters] = useState<QuestionFilters>({ page: 1, limit: 10, ...initial })
  const debounced = useDebounced(filters)
  const result = useAsync(() => questionsApi.list(debounced), [JSON.stringify(debounced)])
  return { filters, setFilters, ...result }
}
