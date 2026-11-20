import { api } from '@/shared/api/http'
import type { SessionView } from '@/features/progress'
import type { PlayQuiz } from '../types'

export const playApi = {
  getQuiz: (quizId: string) => api.get<PlayQuiz>(`/quizzes/${quizId}/play`),
  /** Opens or resumes the session; with assignmentId the attempt counts for that homework. */
  startSession: (quizId: string, assignmentId?: string) =>
    api.post<SessionView>('/progress/sessions', { quizId, assignmentId }),
}
