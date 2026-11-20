import { api } from '@/shared/api/http'
import type { SessionView } from '@/features/progress'
import type { PlayQuiz } from '../types'

/**
 * Query keys of this feature. Both queries use `gcTime: 0`: a game always
 * starts from the server (lock state, shuffling, the open session), never
 * from a cached copy.
 */
export const playKeys = {
  quiz: (quizId: string) => ['play', 'quiz', quizId] as const,
  session: (quizId: string, assignmentId?: string) => ['play', 'session', quizId, assignmentId ?? null] as const,
}

export const playApi = {
  getQuiz: (quizId: string) => api.get<PlayQuiz>(`/quizzes/${quizId}/play`),
  /** Opens or resumes the session; with assignmentId the attempt counts for that homework. */
  startSession: (quizId: string, assignmentId?: string) =>
    api.post<SessionView>('/progress/sessions', { quizId, assignmentId }),
}
