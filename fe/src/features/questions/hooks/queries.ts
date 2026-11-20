import { useQuery } from '@tanstack/react-query'
import { queryClient } from '@/shared/api/query-client'
import { questionsApi } from '../api/questions.api'
import type { QuestionFilters } from '../types'

/** Query keys of this feature; everything lives under ['questions']. */
export const questionKeys = {
  all: ['questions'] as const,
  list: (filters: QuestionFilters) => ['questions', 'list', filters] as const,
  topics: ['questions', 'topics'] as const,
  detail: (id: string) => ['questions', 'detail', id] as const,
}

/** After any create/update/delete/import: lists, topics and details refetch. */
export const invalidateQuestions = () => queryClient.invalidateQueries({ queryKey: questionKeys.all })

export function useTopics() {
  return useQuery({ queryKey: questionKeys.topics, queryFn: questionsApi.topics })
}

/**
 * One question for the editor. `gcTime: 0` drops it when the editor closes,
 * so the form (which copies it into local state once) never starts from an
 * outdated cached copy.
 */
export function useQuestion(id: string | undefined) {
  return useQuery({
    queryKey: questionKeys.detail(id ?? ''),
    queryFn: () => questionsApi.get(id!),
    enabled: !!id,
    gcTime: 0,
  })
}
