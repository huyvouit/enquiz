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
  /** timeLimitSec: suggested time when given as an exam (plan E6); null = none. */
  settings: { shuffleQuestions: boolean; timeLimitSec: number | null }
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
  settings?: { shuffleQuestions?: boolean; timeLimitSec?: number | null }
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
