import type { MatchPair, QuestionType } from '@/shared/api/types'

/** A question as served by GET /quizzes/:id/play — no answer key. */
export interface PlayQuestion {
  id: string
  type: QuestionType
  /** fill_in_blank: contains exactly one BLANK ("___"). */
  questionText: string
  mediaUrl?: string
  /**
   * Listening: MP3 made by the server's text-to-speech. The text itself is
   * never sent, since it is often the answer (plan D16).
   */
  audioUrl?: string
  /** Listening question whose audio is not ready yet. */
  audioPending?: true
  /** multiple_choice: shuffled choices. fill_in_blank: shuffled word bank (absent = typing). */
  options?: string[]
  matching?: { lefts: string[]; rights: string[] }
  /** ordering: the pieces, scrambled. */
  ordering?: { items: string[] }
}

export interface PlayQuiz {
  id: string
  title: string
  topic: string
  gradeLevel: number
  coverEmoji: string
  questions: PlayQuestion[]
}

/**
 * multiple_choice / fill_in_blank -> string, matching -> MatchPair[],
 * ordering -> string[] (pieces in the order the child placed them).
 */
export type PlayAnswer = string | string[] | MatchPair[]

/** Answer shape of the types whose game has its own "Kiểm tra" button. */
export type TypedAnswer = string | string[]

/** The blank of a fill-in-the-blank question (same as the backend). */
export const BLANK = '___'
