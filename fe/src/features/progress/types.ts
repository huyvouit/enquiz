import type { QuestionType } from '@/shared/api/types'

/** Same value as PASS_SCORE in the backend progression rules. */
export const PASS_SCORE = 60

export interface AnswerFeedback {
  questionId: string
  studentAnswer: unknown
  isCorrect: boolean
  correctAnswer: unknown
  explanation?: string
}

export interface SessionView {
  sessionId: string
  quizId: string
  startedAt: string
  answers: AnswerFeedback[]
}

export interface AttemptDetailItem extends AnswerFeedback {
  /** null when the question was deleted after the attempt. */
  type: QuestionType | null
  questionText: string | null
  mediaUrl?: string
}

export interface QuizRef {
  id: string
  title: string
  coverEmoji: string
}

export interface AttemptProgression {
  passed: boolean
  xpEarned: number
  leveledUp: boolean
  levelAfter: number
  /** Only set right after finishing (null when reopened later). */
  totalXp: number | null
  unlockedQuiz: QuizRef | null
}

/** classic: practice (map or homework). exam: timed test (plan 4.2). */
export type AttemptMode = 'classic' | 'exam'

export interface AttemptResult {
  attemptId: string
  mode: AttemptMode
  /** Exam handed in by the timer or by the server after the deadline. */
  isAutoSubmit: boolean
  /**
   * Exam whose teacher shows answers after the due date: correct answers and
   * explanations are left out until then (ISO date). null = shown.
   */
  answersHiddenUntil: string | null
  quizId: string
  quizTitle: string | null
  coverEmoji: string | null
  score: number
  correctCount: number
  totalQuestions: number
  progression: AttemptProgression
  durationSec?: number
  completedAt: string
  details: AttemptDetailItem[]
}

export interface AttemptSummary {
  attemptId: string
  quizId: string
  quizTitle: string | null
  coverEmoji: string | null
  score: number
  correctCount: number
  totalQuestions: number
  passed: boolean
  xpEarned: number
  mode: AttemptMode
  completedAt: string
  student?: { id: string; fullName: string; username: string }
}

export type StationStatus = 'locked' | 'unlocked' | 'passed'

export interface QuestMapStation {
  id: string
  title: string
  description?: string
  topic: string
  coverEmoji: string
  questionCount: number
  status: StationStatus
  bestScore: number | null
}

export interface QuestMap {
  gradeLevel: number
  level: number
  xp: number
  passScore: number
  stations: QuestMapStation[]
}

export type LeaderboardPeriod = 'week' | 'month' | 'all'

export interface LeaderboardEntry {
  rank: number
  studentId: string
  fullName: string
  level: number
  xp: number
}

/** grade: everyone in a grade, short names ("Anh N."). class: one class, full names. */
export type LeaderboardScope = 'grade' | 'class'

export interface Leaderboard {
  period: LeaderboardPeriod
  scope: LeaderboardScope
  gradeLevel: number
  /** Set for scope=class. */
  classId: string | null
  className: string | null
  since: string | null
  entries: LeaderboardEntry[]
  me: LeaderboardEntry | null
}
