import type { PlayQuestion } from '@/features/play'

/** Same values as the backend state machine (plan 5, L5). */
export type LivePhase = 'lobby' | 'countdown' | 'answering' | 'reveal' | 'leaderboard' | 'podium' | 'ended'

export interface LiveStanding {
  playerId: string
  nickname: string
  score: number
  correctCount: number
  rank: number
}

/** Fields both screens get in every snapshot. */
export interface LiveCommonView {
  pin: string
  quizTitle: string
  coverEmoji: string
  phase: LivePhase
  /** -1 in the lobby. */
  questionIndex: number
  totalQuestions: number
  /** During countdown, answering and reveal. Multiple choice only (L1). */
  question: PlayQuestion | null
  /** ISO times by the server clock; correct with `serverNow`. */
  phaseEndsAt: string | null
  answerEndsAt: string | null
  serverNow: string
  questionTimeSec: number
  /** Only in the reveal phase. */
  reveal: { correctIndex: number; distribution: number[] } | null
  /** Top 5 on the leaderboard and the podium. */
  top: LiveStanding[]
  playerCount: number
}

/** `room:state` — what a player's device shows. */
export interface LivePlayerView extends LiveCommonView {
  me: {
    playerId: string
    nickname: string
    isGuest: boolean
    score: number
    rank: number | null
    correctCount: number
    /** Option chosen for the current question. */
    answer: number | null
    /** After the reveal: how this question went. */
    lastResult: { isCorrect: boolean; points: number } | null
  }
}

export interface LiveHostPlayer {
  playerId: string
  nickname: string
  isGuest: boolean
  online: boolean
  answered: boolean
  score: number
  rank: number | null
}

/** `host:state` — what the projector shows. */
export interface LiveHostView extends LiveCommonView {
  matchId: string
  className: string | null
  allowGuests: boolean
  autoAdvanceSec: number | null
  players: LiveHostPlayer[]
  answeredCount: number
  onlineCount: number
  /** Full ranking on the podium. */
  standings: LiveStanding[]
  /** Quiz questions left out (not multiple choice). */
  skippedCount: number
}

/** Acknowledgement of every socket event. */
export type LiveAck<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string; message: string }

/** GET /live/pin/:pin */
export interface LivePinInfo {
  quizTitle: string
  coverEmoji: string
  className: string | null
  allowGuests: boolean
  started: boolean
}

export interface CreateLiveMatchInput {
  quizId: string
  classId?: string
  questionTimeSec?: 10 | 20 | 30 | 60
  allowGuests?: boolean
  autoAdvance?: boolean
}

export interface CreatedLiveMatch {
  matchId: string
  pin: string
  playableCount: number
  skippedCount: number
}

export interface LiveMatchSummary {
  id: string
  quizId: string
  quizTitle: string
  coverEmoji: string
  classId: string | null
  className: string | null
  status: 'ended' | 'aborted'
  playerCount: number
  guestCount: number
  questionCount: number
  averageCorrectRate: number
  winner: string | null
  endedAt: string
}

export interface LiveMatchReport extends LiveMatchSummary {
  settings: { questionTimeSec: number; allowGuests: boolean; autoAdvanceSec: number | null }
  startedAt: string | null
  questions: {
    questionId: string
    questionText: string
    options: string[]
    correctIndex: number
    distribution: number[]
    answeredCount: number
    correctRate: number
    avgMs: number | null
    hardest: boolean
  }[]
  players: {
    playerId: string
    userId: string | null
    nickname: string
    isGuest: boolean
    score: number
    correctCount: number
    rank: number
  }[]
}
