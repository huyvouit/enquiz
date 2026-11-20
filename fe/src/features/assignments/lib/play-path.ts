import type { MyAssignment } from '../types'

/**
 * Link that starts the homework (the session is tied to the assignment).
 * Exams open the exam room, which starts with an intro screen (plan E13).
 */
export const playPath = (a: Pick<MyAssignment, 'id' | 'quiz' | 'mode'>) =>
  a.mode === 'exam' ? `/exam/${a.id}` : `/play/${a.quiz?.id ?? ''}?assignment=${a.id}`

/** "📝 Kiểm tra · 15 phút" */
export const examLabel = (a: { timeLimitSec: number | null }) =>
  `📝 Kiểm tra${a.timeLimitSec ? ` · ${Math.round(a.timeLimitSec / 60)} phút` : ''}`

/** Button label for an exam homework, by the student's session state. */
export function examAction(a: Pick<MyAssignment, 'exam'>): string {
  if (a.exam?.state === 'in_progress') return 'Làm tiếp ⏱'
  if (a.exam?.state === 'submitted') return '📊 Xem kết quả'
  return '📝 Làm bài kiểm tra'
}
