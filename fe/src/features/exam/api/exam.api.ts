import { api } from '@/shared/api/http'
import type { ExamIntro, ExamResult, ExamSession, ExamState } from '../types'

/** Answers + flags sent with a draft save or the hand-in. */
export interface SheetPayload {
  answers: { questionId: string; answer: unknown }[]
  flagged: string[]
}

/** Exam data is always fresh from the server (timer, draft, attempt lock). */
export const examKeys = {
  intro: (assignmentId: string) => ['exam', 'intro', assignmentId] as const,
  state: (sessionId: string) => ['exam', 'state', sessionId] as const,
}

export const examApi = {
  intro: (assignmentId: string) => api.get<ExamIntro>(`/exams/assignments/${assignmentId}`),
  /** Starts the timer, or continues the session in progress (safe to repeat). */
  start: (assignmentId: string) => api.post<ExamSession>('/exams/start', { assignmentId }),
  get: (sessionId: string) => api.get<ExamState>(`/exams/${sessionId}`),
  saveDraft: (sessionId: string, sheet: SheetPayload) =>
    api.patch<{ draftSavedAt: string }>(`/exams/${sessionId}/answers`, sheet),
  /** Grading can take a moment on a slow connection: longer timeout. */
  submit: (sessionId: string, sheet: SheetPayload & { isAutoSubmit: boolean }) =>
    api.post<ExamResult>(`/exams/${sessionId}/submit`, sheet, 30_000),
}
