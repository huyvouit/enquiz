import { api, downloadFile } from '@/shared/api/http'
import type {
  AssignmentDetail,
  ClassOverview,
  DateRange,
  ExportFormat,
  Gradebook,
  QuestionHeatmap,
  StudentReport,
  TopicHeatmap,
} from '../types'

export const analyticsApi = {
  overview: (classId: string, range: DateRange) =>
    api.get<ClassOverview>(`/analytics/classes/${classId}/overview`, range),
  topics: (classId: string, range: DateRange) =>
    api.get<TopicHeatmap>(`/analytics/classes/${classId}/topics`, range),
  gradebook: (classId: string, range: DateRange) =>
    api.get<Gradebook>(`/analytics/classes/${classId}/gradebook`, range),
  studentReport: (classId: string, studentId: string, range: DateRange) =>
    api.get<StudentReport>(`/analytics/classes/${classId}/students/${studentId}`, range),
  assignmentHeatmap: (assignmentId: string) =>
    api.get<QuestionHeatmap>(`/analytics/assignments/${assignmentId}/heatmap`),
  /** The submission table of one homework (owned by the assignments module). */
  assignment: (assignmentId: string) => api.get<AssignmentDetail>(`/assignments/${assignmentId}`),

  exportGradebook: (classId: string, range: DateRange, format: ExportFormat) =>
    downloadFile(`/analytics/classes/${classId}/gradebook/export`, { ...range, format }, `bang-diem.${format}`),
  exportAssignment: (assignmentId: string, format: ExportFormat) =>
    downloadFile(`/analytics/assignments/${assignmentId}/export`, { format }, `ket-qua.${format}`),
  exportStudentReport: (classId: string, studentId: string, range: DateRange) =>
    downloadFile(
      `/analytics/classes/${classId}/students/${studentId}/export`,
      range,
      'phieu-tien-do.pdf',
    ),
}
