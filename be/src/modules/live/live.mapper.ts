import type { LiveMatchDoc } from './schemas/live-match.schema.js';

/** Row of a teacher's match history. */
export interface LiveMatchSummary {
  id: string;
  quizId: string;
  quizTitle: string;
  coverEmoji: string;
  classId: string | null;
  className: string | null;
  status: 'ended' | 'aborted';
  playerCount: number;
  guestCount: number;
  questionCount: number;
  /** Average correct rate over the questions played, 0–100. */
  averageCorrectRate: number;
  winner: string | null;
  endedAt: Date;
}

/** GET /live/matches/:id — the post-game report (plan 5, L12). */
export interface LiveMatchReport extends LiveMatchSummary {
  settings: LiveMatchDoc['settings'];
  startedAt: Date | null;
  questions: {
    questionId: string;
    questionText: string;
    options: string[];
    correctIndex: number;
    distribution: number[];
    answeredCount: number;
    correctRate: number;
    avgMs: number | null;
    /** Lowest correct rate of the match. */
    hardest: boolean;
  }[];
  players: {
    playerId: string;
    userId: string | null;
    nickname: string;
    isGuest: boolean;
    score: number;
    correctCount: number;
    rank: number;
  }[];
}

export function toMatchSummary(m: LiveMatchDoc): LiveMatchSummary {
  const rates = m.questions.map((q) => q.correctRate);
  const winner = [...m.players].sort((a, b) => a.rank - b.rank)[0];
  return {
    id: m._id.toString(),
    quizId: m.quizId.toString(),
    quizTitle: m.quizTitle,
    coverEmoji: m.coverEmoji,
    classId: m.classId?.toString() ?? null,
    className: m.className,
    status: m.status,
    playerCount: m.players.length,
    guestCount: m.players.filter((p) => p.isGuest).length,
    questionCount: m.questions.length,
    averageCorrectRate:
      rates.length === 0
        ? 0
        : Math.round(rates.reduce((a, b) => a + b, 0) / rates.length),
    winner: winner?.nickname ?? null,
    endedAt: m.endedAt,
  };
}

export function toMatchReport(m: LiveMatchDoc): LiveMatchReport {
  const lowest = Math.min(...m.questions.map((q) => q.correctRate));
  return {
    ...toMatchSummary(m),
    settings: m.settings,
    startedAt: m.startedAt,
    questions: m.questions.map((q) => ({
      questionId: q.questionId.toString(),
      questionText: q.questionText,
      options: q.options,
      correctIndex: q.correctIndex,
      distribution: q.distribution,
      answeredCount: q.answeredCount,
      correctRate: q.correctRate,
      avgMs: q.avgMs,
      hardest: m.questions.length > 1 && q.correctRate === lowest,
    })),
    players: [...m.players]
      .sort((a, b) => a.rank - b.rank || a.nickname.localeCompare(b.nickname))
      .map((p) => ({
        playerId: p.playerId,
        userId: p.userId?.toString() ?? null,
        nickname: p.nickname,
        isGuest: p.isGuest,
        score: p.score,
        correctCount: p.correctCount,
        rank: p.rank,
      })),
  };
}
