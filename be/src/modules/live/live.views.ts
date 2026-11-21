/**
 * Snapshots sent over the socket (plan 5, `room:state` / `host:state`).
 * Every change sends each screen its full picture, so a reconnecting device
 * (L10) needs nothing else. Answer secrecy: the correct option is included
 * only once the question is revealed.
 */
import type { PlayQuestion } from '../quizzes/quizzes.mapper.js';
import {
  activePlayers,
  type LivePhase,
  type LiveRoomState,
  standings,
} from './live-room.machine.js';
import type { LiveRoom } from './live-room.registry.js';
import type { Standing } from './live-scoring.js';

/** Top of the leaderboard shown between questions. */
export const LEADERBOARD_SIZE = 5;

export interface LiveStandingView {
  playerId: string;
  nickname: string;
  score: number;
  correctCount: number;
  rank: number;
}

interface CommonView {
  pin: string;
  quizTitle: string;
  coverEmoji: string;
  phase: LivePhase;
  /** -1 in the lobby. */
  questionIndex: number;
  totalQuestions: number;
  /** Shown during countdown, answering and reveal. */
  question: PlayQuestion | null;
  /** End of the current timed phase (countdown, answering, auto-advance). */
  phaseEndsAt: string | null;
  /** End of the answer time of the current question, once known. */
  answerEndsAt: string | null;
  /** The device clock is corrected with this (as in exams, E1). */
  serverNow: string;
  questionTimeSec: number;
  /** Revealed question: correct option and how many chose each option. */
  reveal: { correctIndex: number; distribution: number[] } | null;
  /** Top 5 on the leaderboard, top 3 matter on the podium. */
  top: LiveStandingView[];
  playerCount: number;
}

export interface LivePlayerView extends CommonView {
  me: {
    playerId: string;
    nickname: string;
    isGuest: boolean;
    score: number;
    rank: number | null;
    correctCount: number;
    /** Option chosen for the current question (null: not yet). */
    answer: number | null;
    /** After the reveal: how this question went. */
    lastResult: { isCorrect: boolean; points: number } | null;
  };
}

export interface LiveHostPlayer {
  playerId: string;
  nickname: string;
  isGuest: boolean;
  online: boolean;
  answered: boolean;
  score: number;
  rank: number | null;
}

export interface LiveHostView extends CommonView {
  matchId: string;
  className: string | null;
  allowGuests: boolean;
  autoAdvanceSec: number | null;
  players: LiveHostPlayer[];
  answeredCount: number;
  onlineCount: number;
  /** Full ranking on the podium (the host's report link opens after it). */
  standings: LiveStandingView[];
  /** Questions the quiz had that are not multiple choice (L1). */
  skippedCount: number;
}

const iso = (t: number | null) =>
  t === null ? null : new Date(t).toISOString();
const view = (s: Standing): LiveStandingView => ({
  playerId: s.playerId,
  nickname: s.nickname,
  score: s.score,
  correctCount: s.correctCount,
  rank: s.rank,
});

const SHOWS_QUESTION: LivePhase[] = ['countdown', 'answering', 'reveal'];
const SHOWS_TOP: LivePhase[] = ['leaderboard', 'podium'];

function answerEndsAt(s: LiveRoomState): number | null {
  if (s.phase === 'answering') return s.phaseEndsAt;
  if (s.phase === 'countdown' && s.phaseEndsAt !== null) {
    return s.phaseEndsAt + s.settings.questionTimeSec * 1000;
  }
  return null;
}

/** The current question is revealed (reveal, leaderboard, podium). */
const isRevealed = (s: LiveRoomState) =>
  s.questionIndex >= 0 && s.revealedCount > s.questionIndex;

function common(room: LiveRoom, ranking: Standing[]): CommonView {
  const s = room.state;
  const q =
    s.questionIndex >= 0 ? room.meta.playQuestions[s.questionIndex] : null;
  let reveal: CommonView['reveal'] = null;
  if (isRevealed(s) && s.phase === 'reveal') {
    const distribution = Array.from(
      { length: q?.options?.length ?? 0 },
      () => 0,
    );
    for (const p of activePlayers(s)) {
      const a = p.answers[s.questionIndex];
      if (a && a.choice < distribution.length) distribution[a.choice]++;
    }
    reveal = {
      correctIndex: s.questions[s.questionIndex].correctIndex,
      distribution,
    };
  }
  return {
    pin: room.pin,
    quizTitle: room.meta.quiz.title,
    coverEmoji: room.meta.quiz.coverEmoji,
    phase: s.phase,
    questionIndex: s.questionIndex,
    totalQuestions: s.questions.length,
    question: q && SHOWS_QUESTION.includes(s.phase) ? q : null,
    phaseEndsAt: iso(s.phaseEndsAt),
    answerEndsAt: iso(answerEndsAt(s)),
    serverNow: new Date().toISOString(),
    questionTimeSec: s.settings.questionTimeSec,
    reveal,
    top: SHOWS_TOP.includes(s.phase)
      ? ranking.slice(0, LEADERBOARD_SIZE).map(view)
      : [],
    playerCount: activePlayers(s).length,
  };
}

export function playerView(room: LiveRoom, playerId: string): LivePlayerView {
  const s = room.state;
  const ranking = standings(s);
  const p = s.players.find((x) => x.id === playerId)!;
  const mine = ranking.find((r) => r.playerId === playerId);
  const current = s.questionIndex >= 0 ? p.answers[s.questionIndex] : undefined;
  return {
    ...common(room, ranking),
    me: {
      playerId: p.id,
      nickname: p.nickname,
      isGuest: p.isGuest,
      score: mine?.score ?? 0,
      rank: mine?.rank ?? null,
      correctCount: mine?.correctCount ?? 0,
      answer: current?.choice ?? null,
      lastResult:
        isRevealed(s) && s.phase !== 'podium'
          ? {
              isCorrect: current?.isCorrect ?? false,
              points: current?.points ?? 0,
            }
          : null,
    },
  };
}

export function hostView(room: LiveRoom): LiveHostView {
  const s = room.state;
  const ranking = standings(s);
  const rankOf = new Map(ranking.map((r) => [r.playerId, r]));
  const players = activePlayers(s).map((p) => ({
    playerId: p.id,
    nickname: p.nickname,
    isGuest: p.isGuest,
    online: p.online,
    answered: s.questionIndex >= 0 && p.answers[s.questionIndex] !== undefined,
    score: rankOf.get(p.id)?.score ?? 0,
    rank: rankOf.get(p.id)?.rank ?? null,
  }));
  return {
    ...common(room, ranking),
    matchId: room.matchId,
    className: room.meta.className,
    allowGuests: room.meta.allowGuests,
    autoAdvanceSec: s.settings.autoAdvanceSec,
    players,
    answeredCount: players.filter((p) => p.answered).length,
    onlineCount: players.filter((p) => p.online).length,
    standings:
      s.phase === 'podium' || s.phase === 'ended' ? ranking.map(view) : [],
    skippedCount: room.meta.skippedCount,
  };
}
