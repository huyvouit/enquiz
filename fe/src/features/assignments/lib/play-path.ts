import type { MyAssignment } from '../types'

/** Link that starts the homework (the session is tied to the assignment). */
export const playPath = (a: Pick<MyAssignment, 'id' | 'quiz'>) =>
  `/play/${a.quiz?.id ?? ''}?assignment=${a.id}`
