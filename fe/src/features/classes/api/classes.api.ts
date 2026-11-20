import { api } from '@/shared/api/http'
import type {
  ClassDetail,
  ClassStatus,
  ClassSummary,
  CreatedStudent,
  GroupView,
  StudentClassView,
} from '../types'

export interface ClassPayload {
  name: string
  gradeLevel: number
  schoolName?: string
}

export interface ClassUpdate {
  name?: string
  gradeLevel?: number
  schoolName?: string
  status?: ClassStatus
}

export interface GroupPayload {
  name: string
  studentIds: string[]
}

export interface TemporaryPassword {
  userId: string
  username: string
  fullName: string
  temporaryPassword: string
}

/** Endpoints of be/src/modules/classes (see docs/features/10-classes.md). */
export const classesApi = {
  /** Teacher: classes I teach (admin: all). */
  listTeaching: (archived = false) => api.get<ClassSummary[]>('/classes', { archived }),
  /** Student: classes I am in. */
  listMine: () => api.get<StudentClassView[]>('/classes'),
  detail: (id: string) => api.get<ClassDetail>(`/classes/${id}`),
  create: (payload: ClassPayload) => api.post<ClassSummary>('/classes', payload),
  update: (id: string, payload: ClassUpdate) => api.put<ClassSummary>(`/classes/${id}`, payload),
  regenerateCode: (id: string) => api.post<ClassSummary>(`/classes/${id}/code`),
  join: (code: string) => api.post<StudentClassView>('/classes/join', { code }),
  bulkCreate: (id: string, fullNames: string[]) =>
    api.post<{ class: ClassDetail; created: CreatedStudent[] }>(`/classes/${id}/students/bulk`, { fullNames }),
  removeStudent: (id: string, studentId: string) => api.delete<void>(`/classes/${id}/students/${studentId}`),
  resetPassword: (id: string, studentId: string) =>
    api.post<TemporaryPassword>(`/classes/${id}/students/${studentId}/reset-password`),
  createGroup: (id: string, payload: GroupPayload) => api.post<GroupView>(`/classes/${id}/groups`, payload),
  updateGroup: (id: string, groupId: string, payload: GroupPayload) =>
    api.put<GroupView>(`/classes/${id}/groups/${groupId}`, payload),
  deleteGroup: (id: string, groupId: string) => api.delete<void>(`/classes/${id}/groups/${groupId}`),
}
