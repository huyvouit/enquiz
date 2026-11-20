/**
 * Mirrors be/src/modules/analytics/analytics.views.ts and the assignment
 * detail of be/src/modules/assignments/assignments.mapper.ts. Change both together.
 * Dates arrive as ISO strings.
 */

export type Skill = 'vocabulary' | 'grammar' | 'listening'

/** Homework submission states (plan D7), computed by the server when read. */
export type SubmissionState = 'on_time' | 'late' | 'pending' | 'missing'
export type GradeCellState = SubmissionState | 'not_assigned'

export interface DateRange {
  from: string
  to: string
}

export interface StudentRef {
  id: string
  fullName: string
  username: string
}

export interface SubmissionCounts {
  assigned: number
  onTime: number
  late: number
  pending: number
  missing: number
}

// ---------- Overview ----------

export interface AttentionItem {
  student: StudentRef
  reasons: string[]
  averageScore: number | null
  missingCount: number
  lastActiveAt: string | null
}

export interface TopicRate {
  topic: string
  skill: Skill
  correctRate: number
  answered: number
}

export interface ClassOverview {
  class: { id: string; name: string; gradeLevel: number }
  range: DateRange
  studentCount: number
  activeLast7Days: number
  averageScore: number | null
  attempts: number
  onTimeRate: number | null
  openAssignments: number
  needsAttention: AttentionItem[]
  weakTopics: TopicRate[]
}

export interface TopicHeatmap {
  range: DateRange
  topics: string[]
  skills: Skill[]
  cells: TopicRate[]
  minAnswers: number
}

// ---------- Question heatmap ----------

export type HeatCell = 'correct' | 'wrong' | 'skipped' | null

export interface HeatmapQuestion {
  id: string
  index: number
  questionText: string
  type: string
  topic: string
  skill: Skill
  correctAnswer: string
  inQuiz: boolean
  answered: number
  correct: number
  correctRate: number | null
  commonWrongAnswer: { answer: string; count: number } | null
}

export interface HeatmapRow {
  student: StudentRef
  score: number | null
  attemptId: string | null
  cells: HeatCell[]
}

export interface QuestionHeatmap {
  className: string
  quiz: { id: string; title: string; coverEmoji: string } | null
  assignmentId: string | null
  questions: HeatmapQuestion[]
  rows: HeatmapRow[]
  firstAttemptOnly: true
}

// ---------- Student report ----------

export interface StudentReport {
  student: StudentRef & { gradeLevel: number; level: number; xp: number }
  class: { id: string; name: string }
  range: DateRange
  xpInRange: number
  map: {
    totalStations: number
    unlocked: number
    passed: number
    current: { id: string; title: string; coverEmoji: string } | null
  }
  homework: {
    counts: SubmissionCounts
    incomplete: { assignmentId: string; quizTitle: string; dueDate: string; state: SubmissionState }[]
  }
  topics: { topic: string; correctRate: number; classRate: number | null; answered: number }[]
  skills: { skill: Skill; correctRate: number; classRate: number | null; answered: number }[]
  weeklyTrend: { weekStart: string; averageScore: number | null; attempts: number }[]
  history: {
    attemptId: string
    quizTitle: string
    coverEmoji: string
    score: number
    passed: boolean
    completedAt: string
    homework: boolean
  }[]
}

// ---------- Gradebook ----------

export interface Gradebook {
  class: {
    id: string
    name: string
    gradeLevel: number
    schoolName: string | null
    teacherName: string
  }
  range: DateRange
  generatedAt: string
  assignments: { id: string; title: string; dueDate: string }[]
  rows: {
    index: number
    student: StudentRef
    cells: { state: GradeCellState; score: number | null }[]
    averageScore: number | null
    average10: number | null
    onTime: number
    late: number
    notSubmitted: number
    level: number
    xp: number
  }[]
  assignmentAverages: (number | null)[]
}

// ---------- Assignment detail (GET /assignments/:id) ----------

export interface SubmissionRow {
  student: StudentRef
  state: SubmissionState
  score: number | null
  submittedAt: string | null
  attempts: number
  attemptId: string | null
  /** Exam handed in by the timer or by the server (plan 4.2). */
  isAutoSubmit: boolean
  /** Exam being taken right now. */
  inProgress: { deadlineAt: string } | null
}

export interface AssignmentDetail {
  id: string
  classId: string
  className: string
  quiz: {
    id: string
    title: string
    coverEmoji: string
    topic: string
    gradeLevel: number
    questionCount: number
  } | null
  target: { kind: 'class' | 'group' | 'students'; groupName: string | null }
  dueDate: string
  status: 'active' | 'closed'
  note: string | null
  createdAt: string
  mode: 'classic' | 'exam'
  timeLimitSec: number | null
  reveal: 'after_submit' | 'after_due'
  counts: SubmissionCounts
  averageScore: number | null
  submissions: SubmissionRow[]
}

export type ExportFormat = 'xlsx' | 'pdf'
