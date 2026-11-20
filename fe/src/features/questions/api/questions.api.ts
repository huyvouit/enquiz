import { api, downloadFile } from '@/shared/api/http'
import type { Paginated } from '@/shared/api/types'
import type { ImportReport, Question, QuestionFilters, QuestionPayload, UploadedImage } from '../types'

/** Drops empty filter values so they are not sent as `?topic=`. */
function cleanParams(filters: QuestionFilters) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== '' && v !== false),
  )
}

export const questionsApi = {
  list: (filters: QuestionFilters) => api.get<Paginated<Question>>('/questions', cleanParams(filters)),
  topics: () => api.get<string[]>('/questions/topics'),
  get: (id: string) => api.get<Question>(`/questions/${id}`),
  create: (payload: QuestionPayload) => api.post<Question>('/questions', payload),
  update: (id: string, payload: QuestionPayload) => api.put<Question>(`/questions/${id}`, payload),
  remove: (id: string) => api.delete<{ id: string }>(`/questions/${id}`),
  /** PNG/JPG/WebP ≤ 1 MB; the server checks the real file type. */
  uploadImage: (file: File) => api.upload<UploadedImage>('/uploads/images', 'file', file),
  /** dryRun=true only validates; nothing is saved. */
  importCsv: (csv: string, dryRun: boolean) =>
    api.post<ImportReport>(`/questions/import?dryRun=${dryRun}`, { csv }),
  downloadTemplate: () => downloadFile('/questions/import/template', undefined, 'mau-cau-hoi-enquiz.csv'),
}
