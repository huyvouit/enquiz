import type { Question } from '@/features/questions'

export type QuizStatus = 'draft' | 'published'

export interface QuizSummary {
  id: string
  title: string
  description?: string
  topic: string
  gradeLevel: number
  coverEmoji: string
  status: QuizStatus
  questionCount: number
  author: { id: string; fullName: string } | null
  createdAt: string
}

export interface QuizDetail extends QuizSummary {
  settings: { shuffleQuestions: boolean }
  questions: Question[]
}

/** Body of POST /quizzes and PUT /quizzes/:id. */
export interface QuizPayload {
  title: string
  description?: string
  topic: string
  gradeLevel: number
  coverEmoji?: string
  questionIds: string[]
  status?: QuizStatus
  settings?: { shuffleQuestions?: boolean }
}

export interface QuizFilters {
  topic?: string
  gradeLevel?: number
  mine?: boolean
  /** Matches the title. */
  search?: string
  page?: number
  /** 1-100, default 20. */
  limit?: number
}

export const COVER_EMOJIS = ['📘', '🦁', '🐶', '🌈', '🔢', '🎒', '👨‍👩‍👧', '🍎', '🚗', '🏠', '⚽', '🎵', '🌞', '🧸'] as const
