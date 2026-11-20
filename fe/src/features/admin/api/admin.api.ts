import { api } from '@/shared/api/http'
import type { Paginated } from '@/shared/api/types'
import type { AdminUser, MapStation, TemporaryPassword, UserFilters } from '../types'

export const adminApi = {
  users: (filters: UserFilters) => api.get<Paginated<AdminUser>>('/admin/users', filters),
  /** active = approve / unlock, disabled = lock. */
  setStatus: (id: string, status: 'active' | 'disabled') =>
    api.patch<AdminUser>(`/admin/users/${id}/status`, { status }),
  resetPassword: (id: string) => api.post<TemporaryPassword>(`/admin/users/${id}/reset-password`),

  mapOrder: (gradeLevel: number) => api.get<MapStation[]>('/quizzes/map-order', { gradeLevel }),
  saveMapOrder: (gradeLevel: number, quizIds: string[]) =>
    api.put<MapStation[]>('/quizzes/map-order', { gradeLevel, quizIds }),
}

/** TanStack Query keys of this feature. */
export const adminKeys = {
  users: (filters: UserFilters) => ['admin', 'users', filters] as const,
  allUsers: ['admin', 'users'] as const,
  mapOrder: (gradeLevel: number) => ['admin', 'map-order', gradeLevel] as const,
}
