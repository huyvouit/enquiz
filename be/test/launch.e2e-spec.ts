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
process.env.UPLOAD_DIR = `${tmpdir()}/enquiz-e2e-launch-${process.pid}`;
process.env.TTS_DRIVER = 'fake';

const { AppModule } = await import('../src/app.module.js');
const { setupApp } = await import('../src/common/setup-app.js');
const { LiveRoomRegistry } =
  await import('../src/modules/live/live-room.registry.js');

const API = '/api/v1';
const DAY = 86_400_000;

type Ack = { ok: boolean; error?: string; [k: string]: unknown };

/** Pre-launch hardening, docs/launch-checklist.md items A1–A5. */
describe('EnQuiz API — launch hardening (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let base: string;
  const sockets: Socket[] = [];
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const login = async (username: string, password: string) =>
    (
      await http
        .post(`${API}/auth/login`)
        .send({ username, password: pw(username, password) })
        .expect(200)
    ).body.data.accessToken as string;

  let adminToken: string;
  /** Author of the shared quiz. */
  let teacherA: string;
  /** Another teacher whose class plays that quiz. */
  let teacherB: string;
  let quizId: string;
  let questionIds: string[];
  let classA: string;
  let classB: string;
  let kidA: { id: string; token: string };
  let kidB: { id: string; token: string };
  let attemptA: string;
  let attemptB: string;

  async function makeClass(token: string, name: string) {
    const c = await http
      .post(`${API}/classes`)
      .set(auth(token))
      .send({ name, gradeLevel: 1 })
      .expect(201);
    const bulk = await http
      .post(`${API}/classes/${c.body.data.id}/students/bulk`)
      .set(auth(token))
      .send({ fullNames: [`Học Sinh ${name}`] })
      .expect(201);
    const k = bulk.body.data.created[0];
    return {
      classId: c.body.data.id as string,
      kid: { id: k.id as string, token: await login(k.username, k.password) },
    };
  }

  /** Assigns the quiz to the class and lets its kid play it once. */
  async function playAsHomework(
    teacher: string,
    classId: string,
    kid: { token: string },
  ): Promise<string> {
    const a = await http
      .post(`${API}/classes/${classId}/assignments`)
      .set(auth(teacher))
      .send({
        quizId,
        target: { kind: 'class' },
        dueDate: new Date(Date.now() + 2 * DAY).toISOString(),
      })
      .expect(201);
    const s = await http
      .post(`${API}/progress/sessions`)
      .set(auth(kid.token))
      .send({ quizId, assignmentId: a.body.data.id })
      .expect(200);
    for (const questionId of questionIds) {
      await http
        .post(`${API}/progress/sessions/${s.body.data.sessionId}/answers`)
        .set(auth(kid.token))
        .send({ questionId, studentAnswer: 'x' })
        .expect(200);
    }
    const done = await http
      .post(`${API}/progress/sessions/${s.body.data.sessionId}/finish`)
      .set(auth(kid.token))
      .expect(201);
    return done.body.data.attemptId;
  }

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

    adminToken = await login('admin', 'admin123');
    teacherA = await login('teacher', 'teacher123');
    const b = await http
      .post(`${API}/auth/register`)
      .send({
        username: 'cobinh',
        password: pw('cobinh', 'secret123'),
        fullName: 'Cô Bình',
        role: 'teacher',
      })
      .expect(201);
    await http
      .patch(`${API}/admin/users/${b.body.data.user.id}/status`)
      .set(auth(adminToken))
      .send({ status: 'active' })
      .expect(200);
    teacherB = b.body.data.accessToken;

    // Teacher A writes and shares a quiz of two multiple-choice questions.
    const bank = await http
      .get(`${API}/questions?type=multiple_choice&gradeLevel=1`)
      .set(auth(teacherA))
      .expect(200);
    questionIds = bank.body.data.items
      .slice(0, 2)
      .map((q: { id: string }) => q.id);
    const quiz = await http
      .post(`${API}/quizzes`)
      .set(auth(teacherA))
      .send({
        title: 'Quiz chia sẻ của cô A',
        topic: 'Animals',
        gradeLevel: 1,
        questionIds,
        status: 'published',
      })
      .expect(201);
    quizId = quiz.body.data.id;

    ({ classId: classA, kid: kidA } = await makeClass(teacherA, 'Lớp A'));
    ({ classId: classB, kid: kidB } = await makeClass(teacherB, 'Lớp B'));
    attemptA = await playAsHomework(teacherA, classA, kidA);
    attemptB = await playAsHomework(teacherB, classB, kidB);
  }, 120_000);

  afterAll(async () => {
    for (const s of sockets) s.disconnect();
    await app?.close();
  });

  describe('A1: a quiz author sees only their own students', () => {
    const studentsIn = (res: request.Response) =>
      res.body.data.map((a: { student: { id: string } }) => a.student.id);

    it('results of a shared quiz: author sees their class, admin sees all', async () => {
      const mine = await http
        .get(`${API}/progress/quiz/${quizId}`)
        .set(auth(teacherA))
        .expect(200);
      expect(studentsIn(mine)).toEqual([kidA.id]);
      const all = await http
        .get(`${API}/progress/quiz/${quizId}`)
        .set(auth(adminToken))
        .expect(200);
      expect(studentsIn(all).sort()).toEqual([kidA.id, kidB.id].sort());
    });

    it("an attempt: the author can't open another teacher's student", async () => {
      await http
        .get(`${API}/progress/attempts/${attemptB}`)
        .set(auth(teacherA))
        .expect(404);
      await http
        .get(`${API}/progress/attempts/${attemptB}`)
        .set(auth(teacherB))
        .expect(200);
      await http
        .get(`${API}/progress/attempts/${attemptA}`)
        .set(auth(teacherA))
        .expect(200);
      await http
        .get(`${API}/progress/attempts/${attemptB}`)
        .set(auth(kidB.token))
        .expect(200);
      await http
        .get(`${API}/progress/attempts/${attemptB}`)
        .set(auth(kidA.token))
        .expect(404);
    });
  });

  describe('A2: live host commands need the same match and its host', () => {
    async function open(token: string): Promise<Socket> {
      const socket = io(`${base}/live`, {
        auth: { token },
        transports: ['websocket'],
        reconnection: false,
        forceNew: true,
      });
      await new Promise<void>((resolve, reject) => {
        socket.once('connect', () => resolve());
        socket.once('connect_error', reject);
      });
      sockets.push(socket);
      return socket;
    }
    const emit = (s: Socket, event: string, payload: unknown = {}) =>
      s.timeout(5_000).emitWithAck(event, payload) as Promise<Ack>;
    const createMatch = async (token: string) =>
      (
        await http
          .post(`${API}/live/matches`)
          .set(auth(token))
          .send({ quizId, questionTimeSec: 20 })
          .expect(201)
      ).body.data as { matchId: string; pin: string };

    it('a stale host tab cannot drive a new room that got the same PIN', async () => {
      const registry = app.get(LiveRoomRegistry);
      const randomPin = registry.randomPin;
      registry.randomPin = () => '424242';

      // Teacher A hosts a match, then it ends and its room is cleared.
      const first = await createMatch(teacherA);
      expect(first.pin).toBe('424242');
      const hostA = await open(teacherA);
      expect((await emit(hostA, 'host:attach', first)).ok).toBe(true);
      expect((await emit(hostA, 'host:end')).ok).toBe(true);
      (registry as unknown as { rooms: Map<string, unknown> }).rooms.delete(
        '424242',
      );

      // Teacher B's new room gets the same PIN.
      const second = await createMatch(teacherB);
      expect(second.pin).toBe('424242');
      const seenByA: unknown[] = [];
      hostA.on('host:state', (v) => seenByA.push(v));
      const hostB = await open(teacherB);
      expect((await emit(hostB, 'host:attach', second)).ok).toBe(true);

      // A's old tab: no control, no snapshots of B's room.
      expect(await emit(hostA, 'host:start')).toMatchObject({
        ok: false,
        error: 'not_host',
      });
      expect(await emit(hostA, 'host:end')).toMatchObject({
        ok: false,
        error: 'not_host',
      });
      // B's own tab still works, and its snapshots never reach A.
      expect((await emit(hostB, 'host:end')).ok).toBe(true);
      await new Promise((r) => setTimeout(r, 100));
      expect(seenByA).toEqual([]);
      registry.randomPin = randomPin;
    });
  });

  describe('A3: guessing class codes is limited', () => {
    it('10 wrong codes a minute, then even a right code waits', async () => {
      const { kid } = await makeClass(teacherA, 'Lớp dò mã');
      for (let i = 0; i < 10; i++) {
        await http
          .post(`${API}/classes/join`)
          .set(auth(kid.token))
          .send({ code: `ZZZZ${String(i).padStart(2, '0')}` })
          .expect(404);
      }
      const blocked = await http
        .post(`${API}/classes/join`)
        .set(auth(kid.token))
        .send({ code: 'ZZZZ99' })
        .expect(429);
      expect(blocked.body.message).toMatch(/chờ 1 phút/);
    });
  });

  describe('A4: heavy routes are limited per account', () => {
    it('creating live rooms: 10 a minute', async () => {
      // A2 already created one room for each teacher.
      const { token } = { token: await login('teacher', 'teacher123') };
      for (let i = 0; i < 9; i++) {
        await http
          .post(`${API}/live/matches`)
          .set(auth(token))
          .send({ quizId, questionTimeSec: 20 })
          .expect(201);
      }
      const res = await http
        .post(`${API}/live/matches`)
        .set(auth(token))
        .send({ quizId, questionTimeSec: 20 })
        .expect(429);
      expect(res.body.message).toMatch(/quá nhanh/);
      // Another teacher has their own counter.
      await http
        .post(`${API}/live/matches`)
        .set(auth(teacherB))
        .send({ quizId, questionTimeSec: 20 })
        .expect(201);
    });
  });

  describe('A5: practice answers are bounded', () => {
    let sessionId: string;

    beforeAll(async () => {
      const { classId, kid } = await makeClass(teacherA, 'Lớp trả lời');
      const a = await http
        .post(`${API}/classes/${classId}/assignments`)
        .set(auth(teacherA))
        .send({
          quizId,
          target: { kind: 'class' },
          dueDate: new Date(Date.now() + 2 * DAY).toISOString(),
        })
        .expect(201);
      const s = await http
        .post(`${API}/progress/sessions`)
        .set(auth(kid.token))
        .send({ quizId, assignmentId: a.body.data.id })
        .expect(200);
      sessionId = s.body.data.sessionId;
      kidA = kid;
    });

    it('rejects an oversized answer', async () => {
      const res = await http
        .post(`${API}/progress/sessions/${sessionId}/answers`)
        .set(auth(kidA.token))
        .send({ questionId: questionIds[0], studentAnswer: 'x'.repeat(30_000) })
        .expect(400);
      expect(res.body.message).toBe('Câu trả lời quá dài');
    });

    it('stores an unexpected shape as no answer (wrong)', async () => {
      const res = await http
        .post(`${API}/progress/sessions/${sessionId}/answers`)
        .set(auth(kidA.token))
        .send({
          questionId: questionIds[0],
          studentAnswer: { $gt: '', nested: { deep: [1, 2, 3] } },
        })
        .expect(200);
      expect(res.body.data).toMatchObject({
        isCorrect: false,
        studentAnswer: null,
      });
    });
  });
});
