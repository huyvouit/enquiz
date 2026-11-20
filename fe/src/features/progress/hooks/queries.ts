import { useQuery } from '@tanstack/react-query'
import { queryClient } from '@/shared/api/query-client'
import { progressApi } from '../api/progress.api'
import type { AttemptResult } from '../types'

/** Query keys of this feature; everything lives under ['progress']. */
export const progressKeys = {
  all: ['progress'] as const,
  map: (grade: number) => ['progress', 'map', grade] as const,
  history: ['progress', 'history'] as const,
  attempt: (id: string) => ['progress', 'attempt', id] as const,
  quizResults: (quizId: string) => ['progress', 'quiz-results', quizId] as const,
}

/**
 * After a quiz is finished: the map (stations, level, XP), the history, the
 * teacher's results and the leaderboards all change.
 */
export const invalidateProgress = () =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: progressKeys.all }),
    queryClient.invalidateQueries({ queryKey: ['leaderboard'] }),
  ])

/** Student: the quest map of one grade. */
export function useQuestMap(grade: number) {
  return useQuery({ queryKey: progressKeys.map(grade), queryFn: () => progressApi.map(grade) })
}

export function useHistory() {
  return useQuery({ queryKey: progressKeys.history, queryFn: progressApi.history })
}

/** `initial`: the result handed over by the game right after submitting (no refetch). */
export function useAttempt(id: string, initial?: AttemptResult) {
  return useQuery({
    queryKey: progressKeys.attempt(id),
    queryFn: () => progressApi.attempt(id),
    initialData: initial?.attemptId === id ? initial : undefined,
  })
}

export function useQuizResults(quizId: string) {
  return useQuery({ queryKey: progressKeys.quizResults(quizId), queryFn: () => progressApi.quizResults(quizId) })
}
