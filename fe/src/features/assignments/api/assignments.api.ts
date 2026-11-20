import type { ClassDetail, ClassSummary } from '@/features/classes'
import { api } from '@/shared/api/http'
import type { Paginated } from '@/shared/api/types'
import type {
  AssignableQuiz,
  AssignmentDetail,
  AssignmentView,
  CreateAssignmentPayload,
  MyAssignment,
  ReminderView,
  UpdateAssignmentPayload,
} from '../types'

export const assignmentsApi = {
  // Teacher
  listForClass: (classId: string, status: 'active' | 'closed' | 'all' = 'all') =>
    api.get<AssignmentView[]>(`/classes/${classId}/assignments`, { status }),
  create: (classId: string, payload: CreateAssignmentPayload) =>
    api.post<AssignmentView>(`/classes/${classId}/assignments`, payload),
  detail: (id: string) => api.get<AssignmentDetail>(`/assignments/${id}`),
  update: (id: string, payload: UpdateAssignmentPayload) =>
    api.patch<AssignmentView>(`/assignments/${id}`, payload),
  remove: (id: string) => api.delete<void>(`/assignments/${id}`),

  // Student
  mine: () => api.get<MyAssignment[]>('/assignments/mine'),
  reminders: () => api.get<ReminderView>('/assignments/mine/reminders'),

  // Pickers used by the assign dialog (own calls: no import from other features).
  myClasses: () => api.get<ClassSummary[]>('/classes'),
  classDetail: (classId: string) => api.get<ClassDetail>(`/classes/${classId}`),
  searchQuizzes: (params: { search?: string; gradeLevel?: number; limit?: number }) =>
    api.get<Paginated<AssignableQuiz>>('/quizzes', params),
  quizTitle: (quizId: string) => api.get<AssignableQuiz>(`/quizzes/${quizId}`),
}
