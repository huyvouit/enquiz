import { api } from '@/shared/api/http'
import type {
  AnswerFeedback,
  AttemptResult,
  AttemptSummary,
  Leaderboard,
  LeaderboardPeriod,
  QuestMap,
  SessionView,
} from '../types'

export const progressApi = {
  // Playing
  startSession: (quizId: string) => api.post<SessionView>('/progress/sessions', { quizId }),
  answer: (sessionId: string, questionId: string, studentAnswer: unknown) =>
    api.post<AnswerFeedback & { alreadyAnswered: boolean }>(`/progress/sessions/${sessionId}/answers`, {
      questionId,
      studentAnswer,
    }),
  finish: (sessionId: string) => api.post<AttemptResult>(`/progress/sessions/${sessionId}/finish`),

  // Progression
  map: (gradeLevel?: number) => api.get<QuestMap>('/progress/map', { gradeLevel }),
  /** scope=class needs classId (members and their teacher only). */
  leaderboard: (
    period: LeaderboardPeriod,
    target: { scope: 'grade'; gradeLevel?: number } | { scope: 'class'; classId: string },
  ) => api.get<Leaderboard>('/progress/leaderboard', { period, ...target }),

  // History & reports
  history: () => api.get<AttemptSummary[]>('/progress/history'),
  attempt: (id: string) => api.get<AttemptResult>(`/progress/attempts/${id}`),
  quizResults: (quizId: string) => api.get<AttemptSummary[]>(`/progress/quiz/${quizId}`),
}
