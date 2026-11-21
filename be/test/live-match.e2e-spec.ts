import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { pw } from './auth-helpers.js';

// Must be set before AppModule is imported (ConfigModule validates on import).
process.env.MONGODB_URI = 'memory';
process.env.JWT_SECRET = 'e2e-test-secret-at-least-16-chars';
process.env.SEED_DEMO_DATA = 'true';
process.env.AUTH_RATE_LIMIT = '1000';
process.env.AUTH_IP_RATE_LIMIT = '1000';
process.env.UPLOAD_DIR = `${tmpdir()}/enquiz-e2e-live-match-${process.pid}`;
process.env.TTS_DRIVER = 'fake';

const { AppModule } = await import('../src/app.module.js');
const { setupApp } = await import('../src/common/setup-app.js');
const { LiveRoomRegistry } =
  await import('../src/modules/live/live-room.registry.js');

const API = '/api/v1';

type Ack = { ok: boolean; error?: string; [k: string]: unknown };
interface View {
  phase: string;
  questionIndex: number;
  question: { id: string; options: string[] } | null;
  reveal: { correctIndex: number; distribution: number[] } | null;
  top: { nickname: string; score: number; rank: number }[];
  me?: {
    playerId: string;
    nickname: string;
    score: number;
    answer: number | null;
    lastResult: { isCorrect: boolean; points: number } | null;
  };
  players?: { playerId: string; online: boolean; answered: boolean }[];
  answeredCount?: number;
}

/** A socket that remembers the last snapshot it was sent. */
interface Screen {
  socket: Socket;
  last: View | null;
  events: string[];
  emit: (event: string, payload?: unknown) => Promise<Ack>;
  until: (pred: (v: View) => boolean) => Promise<View>;
}

describe('EnQuiz API — phase 5.1–5.3: live match (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let base: string;
  let registry: InstanceType<typeof LiveRoomRegistry>;
  /** Frozen room clock: points do not depend on how fast the test runs. */
  let clock = Date.now();
  const screens: Screen[] = [];
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const login = async (username: string, password: string) =>
    (
      await http
        .post(`${API}/auth/login`)
        .send({ username, password: pw(username, password) })
        .expect(200)
    ).body.data.accessToken as string;

  /** Moves the room clock forward and runs the timers (no real waiting). */
  const advance = (ms: number) => {
    clock += ms;
    registry.tickAll();
  };

  async function open(token: string | null): Promise<Screen> {
    const socket = io(`${base}/live`, {
      auth: token ? { token } : {},
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });
    const screen: Screen = {
      socket,
      last: null,
      events: [],
      emit: (event, payload) =>
        socket.timeout(5_000).emitWithAck(event, payload ?? {}) as Promise<Ack>,
      until: async (pred) => {
        for (let i = 0; i < 150; i++) {
          if (screen.last && pred(screen.last)) return screen.last;
          await new Promise((r) => setTimeout(r, 20));
        }
        throw new Error(`state never matched; last: ${screen.last?.phase}`);
      },
    };
    socket.on('room:state', (v: View) => (screen.last = v));
    socket.on('host:state', (v: View) => (screen.last = v));
    for (const e of ['player:kicked', 'player:replaced', 'room:closed']) {
      socket.on(e, () => screen.events.push(e));
    }
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', reject);
    });
    screens.push(screen);
    return screen;
  }

  async function join(screen: Screen, payload: object) {
    const ack = await screen.emit('player:join', payload);
    if (ack.ok) screen.last = ack.state as View;
    return ack;
  }

  let teacherToken: string;
  let quizId: string;
  const correctText = new Map<string, string>();
  const kids: { id: string; token: string }[] = [];
  let classId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.listen(0);
    const server = app.getHttpServer() as unknown as {
      address(): AddressInfo;
    };
    base = `http://127.0.0.1:${server.address().port}`;
    http = request(app.getHttpServer());
    registry = app.get(LiveRoomRegistry);
    registry.now = () => clock;

    teacherToken = await login('teacher', 'teacher123');
    const c = await http
      .post(`${API}/classes`)
      .set(auth(teacherToken))
      .send({ name: 'Lớp 1D', gradeLevel: 1 })
      .expect(201);
    classId = c.body.data.id;
    const bulk = await http
      .post(`${API}/classes/${classId}/students/bulk`)
      .set(auth(teacherToken))
      .send({ fullNames: ['Nguyễn Minh An', 'Trần Bảo', 'Lê Chi'] })
      .expect(201);
    for (const k of bulk.body.data.created) {
      kids.push({ id: k.id, token: await login(k.username, k.password) });
    }
    // A grade-1 system quiz with multiple choice and matching questions.
    const quizzes = (
      await http
        .get(`${API}/quizzes?gradeLevel=1`)
        .set(auth(teacherToken))
        .expect(200)
    ).body.data.items as { id: string }[];
    for (const q of quizzes) {
      const detail = (
        await http
          .get(`${API}/quizzes/${q.id}`)
          .set(auth(teacherToken))
          .expect(200)
      ).body.data;
      const types = detail.questions.map((x: { type: string }) => x.type);
      if (types.includes('multiple_choice') && types.includes('matching')) {
        quizId = q.id;
        for (const x of detail.questions) {
          if (x.type === 'multiple_choice')
            correctText.set(x.id, x.correctAnswer);
        }
        break;
      }
    }
    expect(quizId).toBeDefined();
  }, 120_000);

  afterEach(() => {
    // Sockets of a test stay open for the next ones of the same match.
  });

  afterAll(async () => {
    for (const s of screens) s.socket.disconnect();
    await app?.close();
  });

  const correctIndexOf = (v: View) =>
    v.question!.options.indexOf(correctText.get(v.question!.id)!);

  describe('class match for logged-in students (5.1)', () => {
    let matchId: string;
    let pin: string;
    let host: Screen;
    const players: Screen[] = [];

    it('opens a room with multiple-choice questions only (L1, L3)', async () => {
      const student = await login('student', 'student123');
      await http
        .post(`${API}/live/matches`)
        .set(auth(student))
        .send({ quizId })
        .expect(403);
      const res = await http
        .post(`${API}/live/matches`)
        .set(auth(teacherToken))
        .send({ quizId, classId, questionTimeSec: 20 })
        .expect(201);
      expect(res.body.data.pin).toMatch(/^\d{6}$/);
      expect(res.body.data.playableCount).toBeGreaterThan(1);
      expect(res.body.data.skippedCount).toBeGreaterThan(0);
      ({ matchId, pin } = res.body.data);

      const info = await http.get(`${API}/live/pin/${pin}`).expect(200);
      expect(info.body.data).toMatchObject({
        className: 'Lớp 1D',
        allowGuests: false,
        started: false,
      });
    });

    it('lets only its host drive the projector', async () => {
      const kid = await open(kids[0].token);
      expect((await kid.emit('host:attach', { matchId })).error).toBe(
        'not_host',
      );
      kid.socket.disconnect();
      host = await open(teacherToken);
      const ack = await host.emit('host:attach', { matchId });
      expect(ack.ok).toBe(true);
      expect((ack.state as View).phase).toBe('lobby');
      expect((await host.emit('host:start')).error).toBe('no_players');
    });

    it('admits the class students with their full names, nobody else', async () => {
      for (const kid of kids) {
        const screen = await open(kid.token);
        const ack = await join(screen, { pin });
        expect(ack.ok).toBe(true);
        players.push(screen);
      }
      expect(players[0].last?.me?.nickname).toBe('Nguyễn Minh An');

      const outsider = await open(await login('student', 'student123'));
      expect((await join(outsider, { pin })).error).toBe('not_in_class');
      const anonymous = await open(null);
      expect((await join(anonymous, { pin, nickname: 'Mèo' })).error).toBe(
        'login_required',
      );
      const teacher = await open(teacherToken);
      expect((await join(teacher, { pin })).error).toBe('students_only');
      await host.until((v) => v.players?.length === 3);
    });

    it('shows the question without its answer, then opens answers (L5)', async () => {
      expect((await host.emit('host:start')).ok).toBe(true);
      const v = await players[0].until((s) => s.phase === 'countdown');
      expect(v.question?.options.length).toBeGreaterThan(1);
      expect(JSON.stringify(v)).not.toContain('correctAnswer');
      expect(v.reveal).toBeNull();
      expect(
        (
          await players[0].emit('player:answer', {
            questionIndex: 0,
            choice: 0,
          })
        ).error,
      ).toBe('wrong_phase');
      advance(3_000);
      await players[0].until((s) => s.phase === 'answering');
    });

    it('scores by speed, one answer each, and reveals when all answered', async () => {
      const v = players[0].last!;
      const right = correctIndexOf(v);
      const wrong = (right + 1) % v.question!.options.length;
      advance(2_000);
      expect(
        (
          await players[0].emit('player:answer', {
            questionIndex: 0,
            choice: right,
          })
        ).ok,
      ).toBe(true);
      expect(
        (
          await players[0].emit('player:answer', {
            questionIndex: 0,
            choice: wrong,
          })
        ).error,
      ).toBe('already_answered');
      await host.until((s) => s.answeredCount === 1);
      // Other players are not told about each answer.
      expect(players[1].last?.phase).toBe('answering');
      await players[1].emit('player:answer', {
        questionIndex: 0,
        choice: wrong,
      });
      advance(4_000);
      await players[2].emit('player:answer', {
        questionIndex: 0,
        choice: right,
      });

      const shown = await players[0].until((s) => s.phase === 'reveal');
      expect(shown.reveal?.correctIndex).toBe(right);
      expect(shown.reveal?.distribution[right]).toBe(2);
      expect(shown.me?.lastResult).toEqual({ isCorrect: true, points: 950 });
      const b = await players[1].until((s) => s.phase === 'reveal');
      expect(b.me?.lastResult).toEqual({ isCorrect: false, points: 0 });
    });

    it('gives a student back their place after reconnecting (5.2)', async () => {
      const before = players[2].last!.me!;
      players[2].socket.disconnect();
      await host.until(
        (s) =>
          s.players?.find((p) => p.playerId === before.playerId)?.online ===
          false,
      );
      const again = await open(kids[2].token);
      const ack = await join(again, { pin });
      expect(ack.playerId).toBe(before.playerId);
      expect(again.last?.me?.score).toBe(before.score);
      expect(again.last?.phase).toBe('reveal');
      players[2] = again;
      await host.until((s) => s.players?.every((p) => p.online) ?? false);

      // A second tab replaces the first one.
      const tab = await open(kids[2].token);
      await join(tab, { pin });
      await new Promise((r) => setTimeout(r, 100));
      expect(again.events).toContain('player:replaced');
      players[2] = tab;
    });

    it('shows the top 5 between questions, then the next question', async () => {
      expect((await host.emit('host:next')).ok).toBe(true);
      const board = await players[1].until((s) => s.phase === 'leaderboard');
      expect(board.top.map((t) => [t.nickname, t.score])).toEqual([
        ['Nguyễn Minh An', 950],
        ['Lê Chi', 850],
        ['Trần Bảo', 0],
      ]);
      await host.emit('host:next');
      advance(3_000);
      await players[0].until(
        (s) => s.phase === 'answering' && s.questionIndex === 1,
      );
    });

    it('lets the host remove a player for good (L7)', async () => {
      const target = players[1].last!.me!.playerId;
      expect((await host.emit('host:kick', { playerId: target })).ok).toBe(
        true,
      );
      await new Promise((r) => setTimeout(r, 100));
      expect(players[1].events).toContain('player:kicked');
      const back = await open(kids[1].token);
      expect((await join(back, { pin })).error).toBe('banned');
    });

    it('ends early counting revealed questions and saves the results (L8, L12)', async () => {
      const v = players[0].last!;
      await players[0].emit('player:answer', {
        questionIndex: 1,
        choice: correctIndexOf(v),
      });
      // Question 2 is answered but never revealed: it does not count.
      expect((await host.emit('host:end')).ok).toBe(true);
      const podium = await players[0].until((s) => s.phase === 'podium');
      expect(podium.top[0]).toMatchObject({
        nickname: 'Nguyễn Minh An',
        rank: 1,
      });

      const report = await http
        .get(`${API}/live/matches/${matchId}`)
        .set(auth(teacherToken))
        .expect(200);
      expect(report.body.data).toMatchObject({
        status: 'ended',
        className: 'Lớp 1D',
        questionCount: 1,
        playerCount: 2,
      });
      expect(report.body.data.questions[0]).toMatchObject({
        answeredCount: 2,
        correctRate: 100,
      });
      const history = await http
        .get(`${API}/live/matches`)
        .set(auth(teacherToken))
        .expect(200);
      expect(history.body.data[0].id).toBe(matchId);

      // Saved like practice: history entry with mode live, XP earned.
      const mine = await http
        .get(`${API}/progress/history`)
        .set(auth(kids[0].token))
        .expect(200);
      expect(mine.body.data[0]).toMatchObject({ mode: 'live', score: 100 });
      expect(mine.body.data[0].xpEarned).toBeGreaterThan(0);

      await host.emit('host:end');
      await new Promise((r) => setTimeout(r, 100));
      expect(players[0].events).toContain('room:closed');
      await http.get(`${API}/live/pin/${pin}`).expect(404);
    });
  });

  describe('guests (5.3) and guest reconnect (5.2)', () => {
    let pin: string;
    let matchId: string;

    it('lets guests in with a clean, unique nickname', async () => {
      const res = await http
        .post(`${API}/live/matches`)
        .set(auth(teacherToken))
        .send({ quizId, allowGuests: true })
        .expect(201);
      ({ pin, matchId } = res.body.data);
      const host = await open(teacherToken);
      await host.emit('host:attach', { matchId });

      const rude = await open(null);
      expect((await join(rude, { pin, nickname: 'đụ má' })).error).toBe(
        'nickname_rude',
      );
      expect((await join(rude, { pin, nickname: 'A' })).error).toBe(
        'nickname_length',
      );
      const a = await open(null);
      const b = await open(null);
      const ackA = await join(a, { pin, nickname: 'Mèo' });
      await join(b, { pin, nickname: 'mèo' });
      expect(ackA.rejoinToken).toEqual(expect.any(String));
      expect(a.last?.me?.nickname).toBe('Mèo');
      expect(b.last?.me?.nickname).toBe('mèo 2');

      // Open room: a student shows as "An N." (plan D3).
      const kid = await open(kids[0].token);
      await join(kid, { pin });
      expect(kid.last?.me?.nickname).toBe('An N.');

      // Guest reconnect with the secret token only (L10).
      const { playerId, rejoinToken } = ackA as {
        playerId: string;
        rejoinToken: string;
      } & Ack;
      a.socket.disconnect();
      const thief = await open(null);
      expect(
        (await thief.emit('player:rejoin', { pin, playerId, rejoinToken: 'x' }))
          .error,
      ).toBe('rejoin_failed');
      const back = await open(null);
      const ack = await back.emit('player:rejoin', {
        pin,
        playerId,
        rejoinToken,
      });
      expect(ack.ok).toBe(true);
      expect((ack.state as View).me?.nickname).toBe('Mèo');
    });

    it('stops guessing PINs after too many wrong ones (L4)', async () => {
      const guesser = await open(null);
      const errors: string[] = [];
      for (let i = 0; i < 12; i++) {
        const wrong = pin === '111111' ? '222222' : '111111';
        errors.push(
          (await join(guesser, { pin: wrong, nickname: 'Thỏ' })).error ?? '',
        );
      }
      expect(errors.filter((e) => e === 'not_found').length).toBeGreaterThan(5);
      expect(errors.at(-1)).toBe('too_many_attempts');
    });
  });
});
