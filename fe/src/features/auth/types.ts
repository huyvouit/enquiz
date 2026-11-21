import type { Role } from '@/shared/api/types'

export type AccountStatus = 'active' | 'pending' | 'disabled'

export interface StudentProfile {
  gradeLevel: number
  /** 1 + number of map stations passed. */
  level: number
  /** Sum of best scores over all quizzes played. */
  xp: number
}

export interface User {
  id: string
  username: string
  fullName: string
  role: Role
  /** pending = teacher waiting for an admin to approve the account. */
  status: AccountStatus
  studentProfile?: StudentProfile
  createdAt: string
}

export interface AuthResult {
  accessToken: string
  user: User
}

export interface LoginPayload {
  username: string
  password: string
  /** "Ghi nhớ đăng nhập trên máy này": 7 days instead of 12 hours (D22). */
  remember?: boolean
}

export interface RegisterPayload {
  username: string
  password: string
  fullName: string
  role: 'student' | 'teacher'
  gradeLevel?: number
}
