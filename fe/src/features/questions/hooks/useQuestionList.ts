import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { errorMessage } from '@/shared/api/http'
import { questionsApi } from '../api/questions.api'
import type { QuestionFilters } from '../types'
import { questionKeys } from './queries'

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
  const query = useQuery({
    queryKey: questionKeys.list(debounced),
    queryFn: () => questionsApi.list(debounced),
    // Keeps the current page on screen while the next one loads.
    placeholderData: keepPreviousData,
  })
  return {
    filters,
    setFilters,
    data: query.data,
    loading: query.isFetching,
    error: query.error ? errorMessage(query.error) : null,
    reload: () => void query.refetch(),
  }
}
