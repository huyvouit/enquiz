import { useQuery } from '@tanstack/react-query'
import { queryClient } from '@/shared/api/query-client'
import { quizzesApi } from '../api/quizzes.api'

/** Query keys of this feature; everything lives under ['quizzes']. */
export const quizKeys = {
  all: ['quizzes'] as const,
  list: (mine: boolean) => ['quizzes', 'list', { mine }] as const,
  detail: (id: string) => ['quizzes', 'detail', id] as const,
}

/** After a quiz is created, edited or deleted. */
export const invalidateQuizzes = () => queryClient.invalidateQueries({ queryKey: quizKeys.all })

/** Teacher dashboard: the first 100 quizzes, own or all visible. */
export function useQuizList(mine: boolean) {
  return useQuery({
    queryKey: quizKeys.list(mine),
    queryFn: () => quizzesApi.list({ mine, limit: 100 }).then((page) => page.items),
  })
}

/** One quiz for the builder; `gcTime: 0` so the form never starts from a stale copy. */
export function useQuizDetail(id: string | undefined) {
  return useQuery({
    queryKey: quizKeys.detail(id ?? ''),
    queryFn: () => quizzesApi.detail(id!),
    enabled: !!id,
    gcTime: 0,
  })
}
