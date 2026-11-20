/**
 * Mirrors be/src/modules/assignments/assignments.mapper.ts and
 * assignment-status.ts. Change both sides together.
 */

export type SubmissionState =
  /** Submitted at least once on or before the due date. */
  | 'on_time'
  /** Submitted, but only after the due date. */
  | 'late'
  /** Not submitted, still time left. */
  | 'pending'
  /** Not submitted and the due date has passed. */
  | 'missing'

export type AssignmentStatus = 'active' | 'closed'
/** classic: practice with instant feedback. exam: timed test (plan 4.2). */
export type AssignmentMode = 'classic' | 'exam'
/** When an exam shows the correct answers to students (plan E12). */
export type RevealPolicy = 'after_submit' | 'after_due'

/** Exam settings shown with every homework. */
export interface ExamSettings {
  mode: AssignmentMode
  /** Exam only (seconds). */
  timeLimitSec: number | null
  reveal: RevealPolicy
}
export type AssignmentTargetKind = 'class' | 'group' | 'students'

export interface Submission {
  state: SubmissionState
  /** Score that counts for the homework (null when not submitted). */
  score: number | null
  submittedAt: string | null
  attempts: number
  /** The attempt whose score counts, for "Xem bài". */
  attemptId: string | null
  /** The counted attempt is an exam handed in by the timer / the server. */
  isAutoSubmit: boolean
}

export interface SubmissionCounts {
  assigned: number
  onTime: number
  late: number
  pending: number
  missing: number
}

/** null when the quiz was deleted after it was assigned. */
export interface AssignmentQuizRef {
  id: string
  title: string
  coverEmoji: string
  topic: string
  gradeLevel: number
  questionCount: number
}

/** One homework in the teacher's list, with live submission counts. */
export interface AssignmentView extends ExamSettings {
  id: string
  classId: string
  quiz: AssignmentQuizRef | null
  target: { kind: AssignmentTargetKind; groupName: string | null }
  dueDate: string
  status: AssignmentStatus
  note: string | null
  createdAt: string
  counts: SubmissionCounts
  averageScore: number | null
}

export interface SubmissionRow extends Submission {
  student: { id: string; fullName: string; username: string }
  /** Exam being taken right now. */
  inProgress: { deadlineAt: string } | null
}

export interface AssignmentDetail extends AssignmentView {
  className: string
  submissions: SubmissionRow[]
}

/** A homework as the student sees it. */
export interface MyAssignment extends Submission, ExamSettings {
  id: string
  classId: string
  className: string
  teacherName: string
  quiz: AssignmentQuizRef | null
  dueDate: string
  note: string | null
  createdAt: string
  closed: boolean
  isNew: boolean
  dueSoon: boolean
  /** Exam homework: the student's session, null when not started. */
  exam: { state: 'in_progress' | 'submitted'; sessionId: string; deadlineAt: string } | null
}

/** GET /assignments/mine/reminders */
export interface ReminderView {
  pendingCount: number
  overdue: MyAssignment[]
  dueSoon: MyAssignment[]
  fresh: MyAssignment[]
}

/** Body of POST /classes/:classId/assignments. */
export interface CreateAssignmentPayload {
  quizId: string
  target: { kind: AssignmentTargetKind; groupId?: string; studentIds?: string[] }
  /** ISO date-time. */
  dueDate: string
  note?: string
  mode?: AssignmentMode
  /** Exam: seconds, 60–5400. Default: the quiz's suggestion, then 15 minutes. */
  timeLimitSec?: number
  reveal?: RevealPolicy
}

/** Body of PATCH /assignments/:id. */
export interface UpdateAssignmentPayload {
  dueDate?: string
  note?: string
  status?: AssignmentStatus
  /** Mode and time: 409 once a student has started. */
  mode?: AssignmentMode
  timeLimitSec?: number
  reveal?: RevealPolicy
}

/** The quiz fields the assign dialog needs (from GET /quizzes). */
export interface AssignableQuiz {
  id: string
  title: string
  coverEmoji: string
  topic: string
  gradeLevel: number
  questionCount: number
  status: 'draft' | 'published'
  author: { id: string; fullName: string } | null
  /** Only in the quiz detail (GET /quizzes/:id), not in lists. */
  settings?: { shuffleQuestions: boolean; timeLimitSec: number | null }
}
