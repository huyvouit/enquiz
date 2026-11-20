/** Types shared by several features. Mirrors the backend contracts. */

export type Role = 'student' | 'teacher' | 'admin'

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

export type QuestionType = 'multiple_choice' | 'matching' | 'fill_in_blank' | 'ordering'

export interface MatchPair {
  left: string
  right: string
}

export const GRADE_LEVELS = [1, 2, 3, 4, 5] as const
