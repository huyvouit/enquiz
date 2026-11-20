import type { PlayAnswer, PlayQuestion } from '@/features/play'
import type { AttemptResult } from '@/features/progress'

/** Same values as the backend ExamStatus. */
export type ExamStatus = 'in_progress' | 'submitted' | 'timed_out'

/** GET /exams/assignments/:id — the start screen (plan E13). */
export interface ExamIntro {
  assignmentId: string
  title: string
  coverEmoji: string
  questionCount: number
  timeLimitSec: number
  dueDate: string
  note: string | null
  className: string
  closed: boolean
  reveal: 'after_submit' | 'after_due'
  state: 'not_started' | 'in_progress' | 'submitted'
  sessionId: string | null
  deadlineAt: string | null
  serverNow: string
}

/** The exam room: questions without answer keys, the saved draft. */
export interface ExamSession {
  sessionId: string
  assignmentId: string
  quizId: string
  title: string
  coverEmoji: string
  status: ExamStatus
  timeLimitSec: number
  startedAt: string
  deadlineAt: string
  /** Server time when sent: the countdown corrects the device clock with it. */
  serverNow: string
  questions: PlayQuestion[]
  answers: ExamAnswer[]
  flagged: string[]
  draftSavedAt: string | null
}

export interface ExamAnswer {
  questionId: string
  answer: unknown
}

export interface ExamResult extends AttemptResult {
  sessionId: string
  assignmentId: string
  status: ExamStatus
}

/** GET /exams/:id */
export interface ExamState {
  status: ExamStatus
  session: ExamSession | null
  result: ExamResult | null
}

/** questionId → answer; what the room edits. */
export type AnswerSheet = Record<string, PlayAnswer>
