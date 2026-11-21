/**
 * The life of one live match (plan 5, L5) as a pure reducer:
 *
 *   lobby → countdown → answering → reveal → leaderboard → countdown … → podium → ended
 *
 * `reduce(state, event, now)` never reads the clock or does I/O, so every
 * rule is unit-tested with a fake time. The registry feeds it host/player
 * events and a periodic `tick`; the gateway turns the returned effects into
 * socket messages.
 */
import { answerPoints, rankPlayers, type Standing } from './live-scoring.js';

export type LivePhase =
  | 'lobby'
  | 'countdown'
  | 'answering'
  | 'reveal'
  | 'leaderboard'
  | 'podium'
  | 'ended';

/** Server-side view of a question: only what the reducer needs. */
export interface LiveQuestion {
  id: string;
  optionCount: number;
  correctIndex: number;
}

export interface LiveSettings {
  questionTimeSec: number;
  /** Question shown, answers locked (L5). */
  countdownSec: number;
  /** null = the host moves on; otherwise reveal/leaderboard last this long. */
  autoAdvanceSec: number | null;
  maxPlayers: number;
}

export const DEFAULT_SETTINGS: LiveSettings = {
  questionTimeSec: 20,
  countdownSec: 3,
  autoAdvanceSec: null,
  maxPlayers: 60,
};

export interface LiveAnswer {
  choice: number;
  elapsedMs: number;
  isCorrect: boolean;
  points: number;
}

export interface LivePlayer {
  id: string;
  /** null for guests (5.3). */
  userId: string | null;
  nickname: string;
  isGuest: boolean;
  online: boolean;
  /** When the connection dropped (null while online), for the grace below. */
  offlineSince: number | null;
  kicked: boolean;
  /** questionIndex → answer. */
  answers: Record<number, LiveAnswer>;
}

export interface LiveRoomState {
  phase: LivePhase;
  settings: LiveSettings;
  questions: LiveQuestion[];
  /** -1 in the lobby. */
  questionIndex: number;
  /** Questions whose answer was shown: only those count for the score. */
  revealedCount: number;
  phaseStartedAt: number;
  /** When a timed phase ends (countdown, answering, auto-advance). */
  phaseEndsAt: number | null;
  players: LivePlayer[];
  /** Kicked players cannot come back with the same account or nickname. */
  banned: { userIds: string[]; nicknames: string[] };
  lastActivityAt: number;
}

export type LiveEvent =
  | {
      type: 'join';
      player: Pick<LivePlayer, 'id' | 'userId' | 'nickname' | 'isGuest'>;
    }
  | { type: 'disconnect'; playerId: string }
  | { type: 'reconnect'; playerId: string }
  | { type: 'kick'; playerId: string }
  | { type: 'start' }
  | { type: 'next' }
  | { type: 'end' }
  | { type: 'answer'; playerId: string; questionIndex: number; choice: number }
  | { type: 'tick' };

/** What the gateway has to broadcast after a transition. */
export type LiveEffect =
  | 'lobby:players'
  | 'question:start'
  | 'question:progress'
  | 'question:reveal'
  | 'leaderboard'
  | 'match:ended'
  | 'room:closed';

export type LiveError =
  | 'wrong_phase'
  | 'room_full'
  | 'banned'
  | 'unknown_player'
  | 'no_players'
  | 'already_answered'
  | 'wrong_question'
  | 'bad_choice'
  | 'too_late';

export interface Transition {
  state: LiveRoomState;
  effects: LiveEffect[];
  /** Set when the event was refused; the state is then unchanged. */
  error?: LiveError;
  /** join: the player id that ended up in the room (new or re-attached). */
  playerId?: string;
}

const sec = (s: number) => s * 1000;
const normalizeName = (name: string) => name.trim().toLocaleLowerCase('vi');

export function createRoomState(
  questions: LiveQuestion[],
  settings: Partial<LiveSettings>,
  now: number,
): LiveRoomState {
  return {
    phase: 'lobby',
    settings: { ...DEFAULT_SETTINGS, ...settings },
    questions,
    questionIndex: -1,
    revealedCount: 0,
    phaseStartedAt: now,
    phaseEndsAt: null,
    players: [],
    banned: { userIds: [], nicknames: [] },
    lastActivityAt: now,
  };
}

/** Players who still take part (not kicked). */
export const activePlayers = (s: LiveRoomState) =>
  s.players.filter((p) => !p.kicked);

/** Ranking over the revealed questions only. */
export function standings(s: LiveRoomState): Standing[] {
  return rankPlayers(
    activePlayers(s).map((p) => {
      const counted = Object.entries(p.answers).filter(
        ([i]) => Number(i) < s.revealedCount,
      );
      return {
        playerId: p.id,
        nickname: p.nickname,
        score: counted.reduce((sum, [, a]) => sum + a.points, 0),
        correctCount: counted.filter(([, a]) => a.isCorrect).length,
      };
    }),
  );
}

/**
 * A dropped connection is still waited for this long: F5 or a Wi-Fi hiccup
 * (2–3 s) must not end the question for the whole class (L10).
 */
export const OFFLINE_GRACE_MS = 10_000;

const stillExpected = (p: LivePlayer, now: number) =>
  p.online ||
  (p.offlineSince !== null && now - p.offlineSince < OFFLINE_GRACE_MS);

/** Players still to answer the current question (online or just dropped). */
export function waitingFor(s: LiveRoomState, now: number): number {
  return activePlayers(s).filter(
    (p) => stillExpected(p, now) && p.answers[s.questionIndex] === undefined,
  ).length;
}

export function reduce(
  state: LiveRoomState,
  event: LiveEvent,
  now: number,
): Transition {
  const result = apply(state, event, now);
  if (result.error || result.state === state) return result;
  return { ...result, state: { ...result.state, lastActivityAt: now } };
}

function apply(s: LiveRoomState, e: LiveEvent, now: number): Transition {
  const refuse = (error: LiveError): Transition => ({
    state: s,
    effects: [],
    error,
  });
  if (s.phase === 'ended' && e.type !== 'tick') return refuse('wrong_phase');

  switch (e.type) {
    case 'join':
      return join(s, e.player, refuse);

    case 'disconnect':
    case 'reconnect': {
      const p = s.players.find((x) => x.id === e.playerId);
      if (!p || p.kicked) return refuse('unknown_player');
      const online = e.type === 'reconnect';
      if (p.online === online) return { state: s, effects: [] };
      const next = withPlayer(s, {
        ...p,
        online,
        offlineSince: online ? null : now,
      });
      return revealIfAllAnswered(next, ['lobby:players'], now);
    }

    case 'kick': {
      const p = s.players.find((x) => x.id === e.playerId);
      if (!p || p.kicked) return refuse('unknown_player');
      const next: LiveRoomState = {
        ...withPlayer(s, {
          ...p,
          kicked: true,
          online: false,
          offlineSince: now,
        }),
        banned: {
          userIds: p.userId
            ? [...s.banned.userIds, p.userId]
            : s.banned.userIds,
          nicknames: [...s.banned.nicknames, normalizeName(p.nickname)],
        },
      };
      return revealIfAllAnswered(next, ['lobby:players'], now);
    }

    case 'start':
      if (s.phase !== 'lobby') return refuse('wrong_phase');
      if (!activePlayers(s).some((p) => p.online)) return refuse('no_players');
      return startQuestion(s, 0, now);

    case 'next':
      return next(s, now, refuse);

    case 'end':
      if (s.phase === 'lobby' || s.phase === 'podium') {
        return {
          state: {
            ...s,
            phase: 'ended',
            phaseEndsAt: null,
            phaseStartedAt: now,
          },
          effects: ['room:closed'],
        };
      }
      // Early end (L5): an unrevealed question in play does not count.
      return toPodium(s, now);

    case 'answer':
      return answer(s, e, now, refuse);

    case 'tick':
      return tick(s, now);
  }
}

function join(
  s: LiveRoomState,
  player: Pick<LivePlayer, 'id' | 'userId' | 'nickname' | 'isGuest'>,
  refuse: (e: LiveError) => Transition,
): Transition {
  if (s.phase === 'podium') return refuse('wrong_phase');
  if (
    (player.userId && s.banned.userIds.includes(player.userId)) ||
    s.banned.nicknames.includes(normalizeName(player.nickname))
  ) {
    return refuse('banned');
  }
  // The same account again (new tab, new device): take its old place (L9).
  const existing = player.userId
    ? s.players.find((p) => p.userId === player.userId)
    : undefined;
  if (existing) {
    return {
      state: withPlayer(s, { ...existing, online: true, offlineSince: null }),
      effects: ['lobby:players'],
      playerId: existing.id,
    };
  }
  if (activePlayers(s).length >= s.settings.maxPlayers) {
    return refuse('room_full');
  }
  return {
    state: {
      ...s,
      players: [
        ...s.players,
        {
          ...player,
          online: true,
          offlineSince: null,
          kicked: false,
          answers: {},
        },
      ],
    },
    effects: ['lobby:players'],
    playerId: player.id,
  };
}

function answer(
  s: LiveRoomState,
  e: Extract<LiveEvent, { type: 'answer' }>,
  now: number,
  refuse: (e: LiveError) => Transition,
): Transition {
  if (s.phase !== 'answering') return refuse('wrong_phase');
  const p = s.players.find((x) => x.id === e.playerId);
  if (!p || p.kicked) return refuse('unknown_player');
  if (e.questionIndex !== s.questionIndex) return refuse('wrong_question');
  if (p.answers[s.questionIndex]) return refuse('already_answered');
  const q = s.questions[s.questionIndex];
  if (
    !Number.isInteger(e.choice) ||
    e.choice < 0 ||
    e.choice >= q.optionCount
  ) {
    return refuse('bad_choice');
  }
  if (s.phaseEndsAt !== null && now > s.phaseEndsAt) return refuse('too_late');

  const elapsedMs = now - s.phaseStartedAt;
  const isCorrect = e.choice === q.correctIndex;
  const points = isCorrect
    ? answerPoints(elapsedMs, sec(s.settings.questionTimeSec))
    : 0;
  const next = withPlayer(s, {
    ...p,
    answers: {
      ...p.answers,
      [s.questionIndex]: { choice: e.choice, elapsedMs, isCorrect, points },
    },
  });
  return revealIfAllAnswered(next, ['question:progress'], now);
}

function next(
  s: LiveRoomState,
  now: number,
  refuse: (e: LiveError) => Transition,
): Transition {
  switch (s.phase) {
    case 'answering': // the host skips the rest of the timer
      return reveal(s, now, []);
    case 'reveal':
      return s.questionIndex >= s.questions.length - 1
        ? toPodium(s, now)
        : {
            state: timed(s, 'leaderboard', now, s.settings.autoAdvanceSec),
            effects: ['leaderboard'],
          };
    case 'leaderboard':
      return startQuestion(s, s.questionIndex + 1, now);
    default:
      return refuse('wrong_phase');
  }
}

function tick(s: LiveRoomState, now: number): Transition {
  if (s.phaseEndsAt === null || now < s.phaseEndsAt) {
    // The grace of a dropped player may have run out (L10).
    return revealIfAllAnswered(s, [], now);
  }
  switch (s.phase) {
    case 'countdown': {
      // Start the answer clock at the scheduled moment, not when the tick
      // happened to run: every player gets the full time.
      const startedAt = s.phaseEndsAt;
      return {
        state: {
          ...s,
          phase: 'answering',
          phaseStartedAt: startedAt,
          phaseEndsAt: startedAt + sec(s.settings.questionTimeSec),
        },
        effects: ['question:start'],
      };
    }
    case 'answering':
      return reveal(s, now, []);
    case 'reveal':
    case 'leaderboard':
      return next(s, now, () => ({ state: s, effects: [] }));
    default:
      return { state: s, effects: [] };
  }
}

function startQuestion(
  s: LiveRoomState,
  index: number,
  now: number,
): Transition {
  return {
    state: {
      ...s,
      phase: 'countdown',
      questionIndex: index,
      phaseStartedAt: now,
      phaseEndsAt: now + sec(s.settings.countdownSec),
    },
    effects: ['question:start'],
  };
}

function reveal(
  s: LiveRoomState,
  now: number,
  before: LiveEffect[],
): Transition {
  return {
    state: {
      ...timed(s, 'reveal', now, s.settings.autoAdvanceSec),
      revealedCount: s.questionIndex + 1,
    },
    effects: [...before, 'question:reveal'],
  };
}

/**
 * Answering ends early once every player still expected has answered (L5):
 * online, or offline for less than OFFLINE_GRACE_MS.
 */
function revealIfAllAnswered(
  s: LiveRoomState,
  effects: LiveEffect[],
  now: number,
): Transition {
  const everyoneDone =
    s.phase === 'answering' &&
    activePlayers(s).some((p) => stillExpected(p, now)) &&
    waitingFor(s, now) === 0;
  return everyoneDone ? reveal(s, now, effects) : { state: s, effects };
}

function toPodium(s: LiveRoomState, now: number): Transition {
  return {
    state: { ...s, phase: 'podium', phaseStartedAt: now, phaseEndsAt: null },
    effects: ['match:ended'],
  };
}

function timed(
  s: LiveRoomState,
  phase: LivePhase,
  now: number,
  seconds: number | null,
): LiveRoomState {
  return {
    ...s,
    phase,
    phaseStartedAt: now,
    phaseEndsAt: seconds === null ? null : now + sec(seconds),
  };
}

function withPlayer(s: LiveRoomState, player: LivePlayer): LiveRoomState {
  return {
    ...s,
    players: s.players.map((p) => (p.id === player.id ? player : p)),
  };
}
