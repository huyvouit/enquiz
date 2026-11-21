import { clientIp } from './live-auth.js';
import {
  createRoomState,
  type LiveEvent,
  type LiveRoomState,
  reduce,
  standings,
  type Transition,
} from './live-room.machine.js';
import { answerPoints, MAX_POINTS, rankPlayers } from './live-scoring.js';

const T0 = 1_000_000;
const questions = [
  { id: 'q1', optionCount: 4, correctIndex: 2 },
  { id: 'q2', optionCount: 2, correctIndex: 0 },
];

/** Runs events in order; each [event, time]. Fails on a refused event. */
function run(
  state: LiveRoomState,
  steps: [LiveEvent, number][],
): { state: LiveRoomState; last: Transition } {
  let last: Transition = { state, effects: [] };
  for (const [event, at] of steps) {
    last = reduce(last.state, event, at);
    if (last.error) throw new Error(`${event.type} refused: ${last.error}`);
  }
  return { state: last.state, last };
}

const join = (id: string, userId: string | null = id): LiveEvent => ({
  type: 'join',
  player: { id, userId, nickname: id.toUpperCase(), isGuest: userId === null },
});
const answer = (
  playerId: string,
  choice: number,
  questionIndex = 0,
): LiveEvent => ({ type: 'answer', playerId, questionIndex, choice });

/** Lobby with players a and b, question 1 open for answers from T0+3s. */
function answeringRoom() {
  const room = createRoomState(questions, {}, T0);
  return run(room, [
    [join('a'), T0],
    [join('b'), T0],
    [{ type: 'start' }, T0],
    [{ type: 'tick' }, T0 + 3_000],
  ]).state;
}

describe('live scoring (L6)', () => {
  it('gives 1000 for an instant answer and 500 at the buzzer', () => {
    expect(answerPoints(0, 20_000)).toBe(MAX_POINTS);
    expect(answerPoints(10_000, 20_000)).toBe(750);
    expect(answerPoints(20_000, 20_000)).toBe(500);
    expect(answerPoints(25_000, 20_000)).toBe(500);
    expect(answerPoints(-5, 20_000)).toBe(MAX_POINTS);
  });

  it('shares ranks on equal scores', () => {
    const ranked = rankPlayers([
      { playerId: '1', nickname: 'Bình', score: 900, correctCount: 1 },
      { playerId: '2', nickname: 'An', score: 900, correctCount: 1 },
      { playerId: '3', nickname: 'Chi', score: 1500, correctCount: 2 },
      { playerId: '4', nickname: 'Dũng', score: 0, correctCount: 0 },
    ]);
    expect(ranked.map((r) => [r.nickname, r.rank])).toEqual([
      ['Chi', 1],
      ['An', 2],
      ['Bình', 2],
      ['Dũng', 4],
    ]);
  });
});

describe('live room state machine (L5)', () => {
  it('runs lobby → countdown → answering with the clock started on schedule', () => {
    const room = createRoomState(questions, {}, T0);
    expect(reduce(room, { type: 'start' }, T0).error).toBe('no_players');

    const started = run(room, [
      [join('a'), T0],
      [{ type: 'start' }, T0 + 100],
    ]);
    expect(started.state.phase).toBe('countdown');
    expect(started.last.effects).toEqual(['question:start']);
    // Answers are locked during the countdown.
    expect(reduce(started.state, answer('a', 2), T0 + 200).error).toBe(
      'wrong_phase',
    );

    // The tick runs late (T0+3.4s) but the answer clock starts at T0+3.1s.
    const open = reduce(started.state, { type: 'tick' }, T0 + 3_400).state;
    expect(open.phase).toBe('answering');
    expect(open.phaseStartedAt).toBe(T0 + 3_100);
    expect(open.phaseEndsAt).toBe(T0 + 3_100 + 20_000);
  });

  it('scores by server time, one answer per question', () => {
    const room = answeringRoom();
    const r = reduce(room, answer('a', 2), T0 + 3_000 + 10_000);
    expect(r.effects).toEqual(['question:progress']);
    expect(r.state.players[0].answers[0]).toEqual({
      choice: 2,
      elapsedMs: 10_000,
      isCorrect: true,
      points: 750,
    });
    expect(reduce(r.state, answer('a', 1), T0 + 14_000).error).toBe(
      'already_answered',
    );
    expect(reduce(r.state, answer('b', 9), T0 + 14_000).error).toBe(
      'bad_choice',
    );
    expect(reduce(r.state, answer('b', 1, 1), T0 + 14_000).error).toBe(
      'wrong_question',
    );
    expect(reduce(r.state, answer('zz', 1), T0 + 14_000).error).toBe(
      'unknown_player',
    );
    expect(reduce(r.state, answer('b', 1), T0 + 23_001).error).toBe('too_late');
  });

  it('reveals early once every online player answered', () => {
    const room = answeringRoom();
    const { last } = run(room, [
      [answer('a', 2), T0 + 4_000],
      [answer('b', 0), T0 + 5_000],
    ]);
    expect(last.effects).toEqual(['question:progress', 'question:reveal']);
    expect(last.state.phase).toBe('reveal');
    expect(last.state.revealedCount).toBe(1);
    expect(standings(last.state).map((s) => [s.playerId, s.score])).toEqual([
      ['a', 975],
      ['b', 0],
    ]);
  });

  it('waits 10 s for a dropped player, not for a kicked one (L10)', () => {
    const room = answeringRoom();
    const answered = reduce(room, answer('a', 2), T0 + 4_000).state;
    const gone = reduce(
      answered,
      { type: 'disconnect', playerId: 'b' },
      T0 + 5_000,
    );
    // F5 takes a couple of seconds: the question goes on meanwhile.
    expect(gone.state.phase).toBe('answering');
    expect(gone.effects).toEqual(['lobby:players']);
    const back = reduce(
      gone.state,
      { type: 'reconnect', playerId: 'b' },
      T0 + 7_000,
    );
    expect(back.state.phase).toBe('answering');
    expect(reduce(gone.state, { type: 'tick' }, T0 + 14_999).state.phase).toBe(
      'answering',
    );
    const late = reduce(gone.state, { type: 'tick' }, T0 + 15_000);
    expect(late.state.phase).toBe('reveal');
    expect(late.effects).toEqual(['question:reveal']);

    const kicked = reduce(
      answered,
      { type: 'kick', playerId: 'b' },
      T0 + 5_000,
    );
    expect(kicked.state.phase).toBe('reveal');
    expect(standings(kicked.state).map((s) => s.playerId)).toEqual(['a']);
  });

  it('reveals when time is up', () => {
    const room = answeringRoom();
    expect(reduce(room, { type: 'tick' }, T0 + 22_999).state.phase).toBe(
      'answering',
    );
    const up = reduce(room, { type: 'tick' }, T0 + 23_000);
    expect(up.state.phase).toBe('reveal');
    expect(up.effects).toEqual(['question:reveal']);
  });

  it('walks reveal → leaderboard → next question → podium on host clicks', () => {
    const room = answeringRoom();
    const s = run(room, [
      [{ type: 'next' }, T0 + 5_000], // skip the rest of the timer
      [{ type: 'next' }, T0 + 6_000],
    ]);
    expect(s.state.phase).toBe('leaderboard');
    expect(s.last.effects).toEqual(['leaderboard']);

    const q2 = run(s.state, [
      [{ type: 'next' }, T0 + 7_000],
      [{ type: 'tick' }, T0 + 10_000],
      [{ type: 'next' }, T0 + 11_000],
    ]);
    expect(q2.state.questionIndex).toBe(1);
    expect(q2.state.phase).toBe('reveal');
    // Last question: reveal goes straight to the podium.
    const end = reduce(q2.state, { type: 'next' }, T0 + 12_000);
    expect(end.state.phase).toBe('podium');
    expect(end.effects).toEqual(['match:ended']);
    const closed = reduce(end.state, { type: 'end' }, T0 + 13_000);
    expect(closed.state.phase).toBe('ended');
    expect(closed.effects).toEqual(['room:closed']);
    expect(reduce(closed.state, join('c'), T0 + 14_000).error).toBe(
      'wrong_phase',
    );
  });

  it('auto-advances when the host chose it', () => {
    const room = createRoomState(questions, { autoAdvanceSec: 5 }, T0);
    const s = run(room, [
      [join('a'), T0],
      [{ type: 'start' }, T0],
      [{ type: 'tick' }, T0 + 3_000],
      [answer('a', 2), T0 + 4_000],
    ]).state;
    expect(s.phase).toBe('reveal');
    expect(reduce(s, { type: 'tick' }, T0 + 8_999).state.phase).toBe('reveal');
    const board = reduce(s, { type: 'tick' }, T0 + 9_000).state;
    expect(board.phase).toBe('leaderboard');
    expect(reduce(board, { type: 'tick' }, T0 + 14_000).state.phase).toBe(
      'countdown',
    );
  });

  it('ends early counting only revealed questions', () => {
    const room = answeringRoom();
    const s = run(room, [
      [answer('a', 2), T0 + 3_000],
      [answer('b', 2), T0 + 3_000],
      [{ type: 'next' }, T0 + 6_000],
      [{ type: 'next' }, T0 + 7_000],
      [{ type: 'tick' }, T0 + 10_000],
      [answer('a', 0, 1), T0 + 10_000], // q2 answered but never revealed
      [{ type: 'end' }, T0 + 11_000],
    ]).state;
    expect(s.phase).toBe('podium');
    expect(standings(s).map((x) => [x.playerId, x.score, x.rank])).toEqual([
      ['a', 1000, 1],
      ['b', 1000, 1],
    ]);
  });

  it('closes a lobby without a podium', () => {
    const room = run(createRoomState(questions, {}, T0), [[join('a'), T0]]);
    const closed = reduce(room.state, { type: 'end' }, T0 + 1);
    expect(closed.state.phase).toBe('ended');
    expect(closed.effects).toEqual(['room:closed']);
  });
});

describe('live room players (L7, L9)', () => {
  it('gives an account its old place when it joins again', () => {
    const room = run(createRoomState(questions, {}, T0), [
      [join('a', 'u1'), T0],
      [{ type: 'disconnect', playerId: 'a' }, T0 + 1],
    ]).state;
    const again = reduce(room, join('a2', 'u1'), T0 + 2);
    expect(again.playerId).toBe('a');
    expect(again.state.players).toHaveLength(1);
    expect(again.state.players[0].online).toBe(true);
  });

  it('keeps kicked accounts and nicknames out', () => {
    const room = run(createRoomState(questions, {}, T0), [
      [join('a', 'u1'), T0],
      [join('g', null), T0],
      [{ type: 'kick', playerId: 'a' }, T0],
      [{ type: 'kick', playerId: 'g' }, T0],
    ]).state;
    expect(reduce(room, join('a2', 'u1'), T0).error).toBe('banned');
    expect(
      reduce(
        room,
        {
          type: 'join',
          player: { id: 'g2', userId: null, nickname: ' g ', isGuest: true },
        },
        T0,
      ).error,
    ).toBe('banned');
  });

  it('caps the room and lets players join late', () => {
    const full = run(createRoomState(questions, { maxPlayers: 2 }, T0), [
      [join('a'), T0],
      [join('b'), T0],
    ]).state;
    expect(reduce(full, join('c'), T0).error).toBe('room_full');

    const late = reduce(answeringRoom(), join('c'), T0 + 5_000);
    expect(late.error).toBeUndefined();
    expect(late.state.players).toHaveLength(3);
  });
});

describe('client address behind proxies (D14)', () => {
  it('counts trusted hops back from the socket peer', () => {
    expect(clientIp('10.0.0.1', undefined, 0)).toBe('10.0.0.1');
    expect(clientIp('10.0.0.1', '1.2.3.4', 1)).toBe('1.2.3.4');
    // A spoofed first entry is ignored when only one proxy is trusted.
    expect(clientIp('10.0.0.1', '6.6.6.6, 1.2.3.4', 1)).toBe('1.2.3.4');
    expect(clientIp('10.0.0.1', '1.2.3.4, 169.254.1.1', 2)).toBe('1.2.3.4');
    expect(clientIp('10.0.0.1', '', 3)).toBe('10.0.0.1');
  });
});
