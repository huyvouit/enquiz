import { api } from '@/shared/api/http'
import type { Paginated } from '@/shared/api/types'
import type { QuizDetail, QuizFilters, QuizPayload, QuizSummary } from '../types'

export const quizzesApi = {
  list: (filters: QuizFilters = {}) => api.get<Paginated<QuizSummary>>('/quizzes', filters),
  detail: (id: string) => api.get<QuizDetail>(`/quizzes/${id}`),
  create: (payload: QuizPayload) => api.post<QuizSummary>('/quizzes', payload),
  update: (id: string, payload: QuizPayload) => api.put<QuizSummary>(`/quizzes/${id}`, payload),
  remove: (id: string) => api.delete<{ id: string }>(`/quizzes/${id}`),
}
