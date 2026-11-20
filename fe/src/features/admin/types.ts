import type { AccountStatus } from '@/features/auth'
import type { Role } from '@/shared/api/types'

/** Mirrors PublicUser (be/src/modules/users/users.mapper.ts). */
export interface AdminUser {
  id: string
  username: string
  fullName: string
  role: Role
  status: AccountStatus
  studentProfile?: { gradeLevel: number; level: number; xp: number }
  createdAt: string
}

export interface UserFilters {
  role?: Role
  status?: AccountStatus
  search?: string
  page: number
  limit: number
}

/** POST /admin/users/:id/reset-password — the password is shown once. */
export interface TemporaryPassword {
  userId: string
  username: string
  fullName: string
  temporaryPassword: string
}

/** A system quiz in quest-map order (QuizSummary from the backend). */
export interface MapStation {
  id: string
  title: string
  topic: string
  gradeLevel: number
  coverEmoji: string
  status: 'draft' | 'published'
  questionCount: number
}
