import type { MatchPair, QuestionType } from '@/shared/api/types'

export type QuestionSkill = 'vocabulary' | 'grammar' | 'listening'

/** Cambridge Young Learners English levels. */
export type YleLevel = 'starters' | 'movers' | 'flyers'

/** Full question including the answer key (teacher/admin only). */
export interface Question {
  id: string
  topic: string
  gradeLevel: number
  type: QuestionType
  skill: QuestionSkill
  /** fill_in_blank: contains exactly one BLANK. */
  questionText: string
  mediaUrl?: string
  /** English text of a listening question (teachers only; students get audioUrl). */
  audioText?: string
  /** MP3 made from audioText when the question was saved; missing = not made yet. */
  audioUrl?: string
  tags: string[]
  yleLevel?: YleLevel
  unit?: string
  /** multiple_choice: choices. fill_in_blank: optional word bank. */
  options?: string[]
  pairs?: MatchPair[]
  /**
   * multiple_choice: string. fill_in_blank: string[] of accepted answers.
   * ordering: string[] in the right order. matching: unused (pairs).
   */
  correctAnswer?: unknown
  explanation?: string
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

/** Body of POST /questions and PUT /questions/:id. */
export interface QuestionPayload {
  topic: string
  gradeLevel: number
  type: AuthorableQuestionType
  skill?: QuestionSkill
  questionText: string
  mediaUrl?: string
  audioText?: string
  options?: string[]
  /** multiple_choice only. */
  correctAnswer?: string
  /** fill_in_blank only. */
  acceptedAnswers?: string[]
  /** ordering only. */
  orderedItems?: string[]
  pairs?: MatchPair[]
  explanation?: string
  tags?: string[]
  yleLevel?: YleLevel
  unit?: string
}

export interface QuestionFilters {
  topic?: string
  gradeLevel?: number
  type?: QuestionType
  search?: string
  mine?: boolean
  page?: number
  limit?: number
}

/** All four types are authorable since phase 3 (same list as the backend). */
export type AuthorableQuestionType = QuestionType
export const AUTHORABLE_TYPES: AuthorableQuestionType[] = ['multiple_choice', 'matching', 'fill_in_blank', 'ordering']

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: 'Trắc nghiệm',
  matching: 'Nối từ',
  fill_in_blank: 'Điền từ',
  ordering: 'Sắp xếp câu',
}

export const QUESTION_TYPE_ICONS: Record<QuestionType, string> = {
  multiple_choice: '🔘',
  matching: '🔗',
  fill_in_blank: '✏️',
  ordering: '🧩',
}

export const SKILL_LABELS: Record<QuestionSkill, string> = {
  vocabulary: 'Từ vựng',
  grammar: 'Ngữ pháp',
  listening: 'Nghe',
}

export const YLE_LABELS: Record<YleLevel, string> = {
  starters: 'Starters',
  movers: 'Movers',
  flyers: 'Flyers',
}

/** The blank of a fill-in-the-blank question. */
export const BLANK = '___'

/** Same limits as the backend DTO. */
export const QUESTION_LIMITS = {
  minOptions: 2,
  maxOptions: 6,
  minPairs: 2,
  maxPairs: 6,
  maxAcceptedAnswers: 5,
  minOrderItems: 2,
  maxOrderItems: 10,
  maxAudioText: 200,
  maxTags: 10,
  maxImageBytes: 1024 * 1024,
} as const

export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']

// ---------- CSV import (POST /questions/import) ----------

export interface ImportReport {
  dryRun: boolean
  total: number
  /** New questions (would be) created. */
  created: number
  /** Admin rows with a known externalId that updated a question. */
  updated: number
  skipped: { line: number; reason: string }[]
  errors: { line: number; messages: string[] }[]
  preview: { line: number; type: QuestionType; topic: string; gradeLevel: number; questionText: string }[]
}

export interface UploadedImage {
  key: string
  url: string
  contentType: string
  size: number
}

/** GET /questions/audio/status (admin). */
export interface AudioStatus {
  /** The server can make audio (TTS_DRIVER is not "none"). */
  enabled: boolean
  missing: number
}

/** POST /questions/audio/backfill (admin): one batch. */
export interface AudioBackfillResult {
  generated: number
  failed: number
  remaining: number
}
