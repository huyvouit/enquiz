import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Connection } from 'mongoose';
import { Types } from 'mongoose';
import { tmpdir } from 'node:os';
import request from 'supertest';
import { App } from 'supertest/types.js';

// Must be set before AppModule is imported (ConfigModule validates on import).
process.env.MONGODB_URI = 'memory';
process.env.JWT_SECRET = 'e2e-test-secret-at-least-16-chars';
process.env.SEED_DEMO_DATA = 'true';
process.env.AUTH_RATE_LIMIT = '1000';
process.env.AUTH_IP_RATE_LIMIT = '1000';
process.env.UPLOAD_DIR = `${tmpdir()}/enquiz-e2e-exam-${process.pid}`;
process.env.TTS_DRIVER = 'fake';

const { AppModule } = await import('../src/app.module.js');
const { setupApp } = await import('../src/common/setup-app.js');

const API = '/api/v1';
const DAY = 86_400_000;

interface QuestionKey {
  id: string;
  type: string;
  correctAnswer?: unknown;
  pairs?: { left: string; right: string }[];
}
interface Kid {
  id: string;
  token: string;
}
type Sheet = { questionId: string; answer: unknown }[];

/** The answer that grades as correct, built from the teacher's view. */
function rightAnswer(q: QuestionKey): unknown {
  if (q.type === 'matching') return q.pairs;
  if (q.type === 'fill_in_blank' && Array.isArray(q.correctAnswer)) {
    return q.correctAnswer[0];
  }
  return q.correctAnswer;
}

describe('EnQuiz API — phase 4.2: exam mode (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let db: Connection;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const login = async (username: string, password: string) =>
    (
      await http
        .post(`${API}/auth/login`)
        .send({ username, password })
        .expect(200)
    ).body.data.accessToken as string;

  let teacherToken: string;
  let classId: string;
  const kids: Kid[] = [];
  let quizId: string;
  let questions: QuestionKey[];
  let allRight: Sheet;
  let examId: string;
  let dueDate: string;

  /** Moves a session's deadline into the past, like a timer running out. */
  const expire = (sessionId: string, msAgo: number) =>
    db
      .collection('exam_sessions')
      .updateOne(
        { _id: new Types.ObjectId(sessionId) },
        { $set: { deadlineAt: new Date(Date.now() - msAgo) } },
      );
  const start = (kid: Kid) =>
    http
      .post(`${API}/exams/start`)
      .set(auth(kid.token))
      .send({ assignmentId: examId });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    http = request(app.getHttpServer());
    db = app.get<Connection>(getConnectionToken());

    teacherToken = await login('teacher', 'teacher123');
    const c = await http
      .post(`${API}/classes`)
      .set(auth(teacherToken))
      .send({ name: 'Lớp 1C', gradeLevel: 1 })
      .expect(201);
    classId = c.body.data.id;
    const bulk = await http
      .post(`${API}/classes/${classId}/students/bulk`)
      .set(auth(teacherToken))
      .send({
        fullNames: ['An Một', 'Bình Hai', 'Chi Ba', 'Dũng Bốn', 'Em Năm'],
      })
      .expect(201);
    for (const k of bulk.body.data.created) {
      kids.push({ id: k.id, token: await login(k.username, k.password) });
    }

    // The first station of the grade-1 map: also playable as practice.
    const map = await http
      .get(`${API}/progress/map`)
      .set(auth(kids[0].token))
      .expect(200);
    quizId = map.body.data.stations[0].id;
    const detail = await http
      .get(`${API}/quizzes/${quizId}`)
      .set(auth(teacherToken))
      .expect(200);
    questions = detail.body.data.questions;
    allRight = questions.map((q) => ({
      questionId: q.id,
      answer: rightAnswer(q),
    }));
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  describe('giving an exam', () => {
    it('rejects an exam time outside 1–90 minutes', async () => {
      dueDate = new Date(Date.now() + 2 * DAY).toISOString();
      await http
        .post(`${API}/classes/${classId}/assignments`)
        .set(auth(teacherToken))
        .send({
          quizId,
          target: { kind: 'class' },
          dueDate,
          mode: 'exam',
          timeLimitSec: 30,
        })
        .expect(400);
    });

    it('defaults to 15 minutes and stores the reveal choice', async () => {
      const res = await http
        .post(`${API}/classes/${classId}/assignments`)
        .set(auth(teacherToken))
        .send({
          quizId,
          target: { kind: 'class' },
          dueDate,
          mode: 'exam',
          reveal: 'after_due',
        })
        .expect(201);
      expect(res.body.data).toMatchObject({
        mode: 'exam',
        timeLimitSec: 900,
        reveal: 'after_due',
      });
      examId = res.body.data.id;

      const classic = await http
        .post(`${API}/classes/${classId}/assignments`)
        .set(auth(teacherToken))
        .send({ quizId, target: { kind: 'class' }, dueDate })
        .expect(201);
      expect(classic.body.data).toMatchObject({
        mode: 'classic',
        timeLimitSec: null,
      });
    });

    it('shows the start screen without starting the timer (E13)', async () => {
      const intro = await http
        .get(`${API}/exams/assignments/${examId}`)
        .set(auth(kids[0].token))
        .expect(200);
      expect(intro.body.data).toMatchObject({
        assignmentId: examId,
        questionCount: questions.length,
        timeLimitSec: 900,
        state: 'not_started',
        sessionId: null,
        closed: false,
        className: 'Lớp 1C',
      });
      const mine = await http
        .get(`${API}/assignments/mine`)
        .set(auth(kids[0].token))
        .expect(200);
      expect(
        mine.body.data.find((a: { id: string }) => a.id === examId),
      ).toMatchObject({ mode: 'exam', timeLimitSec: 900, exam: null });
    });

    it('cannot be opened as practice homework', async () => {
      await http
        .post(`${API}/progress/sessions`)
        .set(auth(kids[0].token))
        .send({ quizId, assignmentId: examId })
        .expect(409);
    });

    it('hides the exam from students it was not given to', async () => {
      const outsider = await login('student', 'student123');
      await http
        .get(`${API}/exams/assignments/${examId}`)
        .set(auth(outsider))
        .expect(404);
      await http
        .post(`${API}/exams/start`)
        .set(auth(outsider))
        .send({ assignmentId: examId })
        .expect(404);
    });
  });

  describe('taking the exam', () => {
    let sessionId: string;

    it('starts once, even with two clicks at the same time (E8)', async () => {
      const [a, b] = await Promise.all([start(kids[0]), start(kids[0])]);
      expect(a.status).toBe(200);
      expect(b.status).toBe(200);
      expect(a.body.data.sessionId).toBe(b.body.data.sessionId);
      sessionId = a.body.data.sessionId;

      const s = a.body.data;
      expect(
        new Date(s.deadlineAt).getTime() - new Date(s.startedAt).getTime(),
      ).toBe(900_000);
      expect(s.questions).toHaveLength(questions.length);
      // No answer key leaves the server.
      const text = JSON.stringify(s.questions);
      expect(text).not.toContain('correctAnswer');
      expect(text).not.toContain('explanation');
      expect(text).not.toContain('audioText');
    });

    it('keeps the same option order when reloaded (E10)', async () => {
      const again = await start(kids[0]).expect(200);
      const get = await http
        .get(`${API}/exams/${sessionId}`)
        .set(auth(kids[0].token))
        .expect(200);
      expect(get.body.data.status).toBe('in_progress');
      expect(get.body.data.session.questions).toEqual(
        again.body.data.questions,
      );
    });

    it('refuses practice of the same quiz meanwhile (E11)', async () => {
      await http
        .post(`${API}/progress/sessions`)
        .set(auth(kids[0].token))
        .send({ quizId })
        .expect(409);
    });

    it('saves the draft and returns it on reload (E2)', async () => {
      const saved = await http
        .patch(`${API}/exams/${sessionId}/answers`)
        .set(auth(kids[0].token))
        .send({
          answers: [
            allRight[0],
            { questionId: new Types.ObjectId().toString(), answer: 'x' },
          ],
          flagged: [questions[1].id],
        })
        .expect(200);
      expect(saved.body.data.draftSavedAt).toBeTruthy();
      const get = await http
        .get(`${API}/exams/${sessionId}`)
        .set(auth(kids[0].token))
        .expect(200);
      expect(get.body.data.session.answers).toEqual([allRight[0]]);
      expect(get.body.data.session.flagged).toEqual([questions[1].id]);
    });

    it('is private to its student', async () => {
      await http
        .get(`${API}/exams/${sessionId}`)
        .set(auth(kids[1].token))
        .expect(404);
      await http
        .post(`${API}/exams/${sessionId}/submit`)
        .set(auth(kids[1].token))
        .send({ answers: [] })
        .expect(404);
    });

    it('fixes mode and time once someone started; reveal can change', async () => {
      await http
        .patch(`${API}/assignments/${examId}`)
        .set(auth(teacherToken))
        .send({ timeLimitSec: 1200 })
        .expect(409);
      await http
        .patch(`${API}/assignments/${examId}`)
        .set(auth(teacherToken))
        .send({ mode: 'classic' })
        .expect(409);
      const detail = await http
        .get(`${API}/assignments/${examId}`)
        .set(auth(teacherToken))
        .expect(200);
      const row = detail.body.data.submissions.find(
        (r: { student: { id: string } }) => r.student.id === kids[0].id,
      );
      expect(row.state).toBe('pending');
      expect(row.inProgress.deadlineAt).toBeTruthy();
    });

    it('grades once on hand-in, without XP or stations (E3, E4)', async () => {
      const res = await http
        .post(`${API}/exams/${sessionId}/submit`)
        .set(auth(kids[0].token))
        .send({ answers: allRight })
        .expect(200);
      const r = res.body.data;
      expect(r).toMatchObject({
        mode: 'exam',
        status: 'submitted',
        isAutoSubmit: false,
        score: 100,
        correctCount: questions.length,
        progression: { xpEarned: 0, leveledUp: false },
      });
      // reveal: after_due → no answers before the due date (E12).
      expect(new Date(r.answersHiddenUntil).toISOString()).toBe(dueDate);
      expect(
        r.details.every(
          (d: { correctAnswer: unknown; isCorrect: boolean }) =>
            d.correctAnswer === null && d.isCorrect,
        ),
      ).toBe(true);

      // A second hand-in (timer + button) gives the same result.
      const again = await http
        .post(`${API}/exams/${sessionId}/submit`)
        .set(auth(kids[0].token))
        .send({ answers: [] })
        .expect(200);
      expect(again.body.data.attemptId).toBe(r.attemptId);
      await start(kids[0]).expect(409);

      const map = await http
        .get(`${API}/progress/map`)
        .set(auth(kids[0].token))
        .expect(200);
      expect(map.body.data.xp).toBe(0);
      expect(map.body.data.stations[0].bestScore).toBeNull();
      expect(map.body.data.stations[1]?.status ?? 'locked').toBe('locked');

      // Practice is open again now that the exam is handed in.
      await http
        .post(`${API}/progress/sessions`)
        .set(auth(kids[0].token))
        .send({ quizId })
        .expect(200);
    });

    it('shows answers to the teacher, and to the student once allowed', async () => {
      const mine = await http
        .get(`${API}/assignments/mine`)
        .set(auth(kids[0].token))
        .expect(200);
      const row = mine.body.data.find((a: { id: string }) => a.id === examId);
      expect(row).toMatchObject({
        state: 'on_time',
        score: 100,
        exam: { state: 'submitted', sessionId },
      });

      const attemptId = row.attemptId as string;
      const asKid = await http
        .get(`${API}/progress/attempts/${attemptId}`)
        .set(auth(kids[0].token))
        .expect(200);
      expect(asKid.body.data.details[0].correctAnswer).toBeNull();
      const asTeacher = await http
        .get(`${API}/progress/attempts/${attemptId}`)
        .set(auth(teacherToken))
        .expect(200);
      expect(asTeacher.body.data.details[0].correctAnswer).not.toBeNull();
      expect(asTeacher.body.data.answersHiddenUntil).toBeNull();

      await http
        .patch(`${API}/assignments/${examId}`)
        .set(auth(teacherToken))
        .send({ reveal: 'after_submit' })
        .expect(200);
      const now = await http
        .get(`${API}/exams/${sessionId}`)
        .set(auth(kids[0].token))
        .expect(200);
      expect(now.body.data.status).toBe('submitted');
      expect(now.body.data.result.answersHiddenUntil).toBeNull();
      expect(now.body.data.result.details[0].correctAnswer).not.toBeNull();
    });
  });

  describe('time running out', () => {
    const draftOfOne = (sessionId: string, kid: Kid) =>
      http
        .patch(`${API}/exams/${sessionId}/answers`)
        .set(auth(kid.token))
        .send({ answers: [allRight[0]] })
        .expect(200);
    const oneRight = () => Math.round((1 / questions.length) * 100);

    it('accepts a hand-in within the grace period', async () => {
      const s = await start(kids[3]).expect(200);
      await expire(s.body.data.sessionId, 5_000);
      const res = await http
        .post(`${API}/exams/${s.body.data.sessionId}/submit`)
        .set(auth(kids[3].token))
        .send({ answers: allRight, isAutoSubmit: true })
        .expect(200);
      expect(res.body.data).toMatchObject({
        status: 'submitted',
        isAutoSubmit: true,
        score: 100,
      });
    });

    it('grades the saved draft, not a late hand-in (E5)', async () => {
      const s = await start(kids[1]).expect(200);
      const id = s.body.data.sessionId;
      await draftOfOne(id, kids[1]);
      await expire(id, 60_000);
      await http
        .patch(`${API}/exams/${id}/answers`)
        .set(auth(kids[1].token))
        .send({ answers: allRight })
        .expect(409);
      const res = await http
        .post(`${API}/exams/${id}/submit`)
        .set(auth(kids[1].token))
        .send({ answers: allRight })
        .expect(200);
      expect(res.body.data).toMatchObject({
        status: 'timed_out',
        isAutoSubmit: true,
        score: oneRight(),
      });
    });

    it('closes an abandoned exam when the teacher reads results', async () => {
      const s = await start(kids[2]).expect(200);
      const id = s.body.data.sessionId;
      await draftOfOne(id, kids[2]);
      await expire(id, 3_600_000);

      const detail = await http
        .get(`${API}/assignments/${examId}`)
        .set(auth(teacherToken))
        .expect(200);
      const row = detail.body.data.submissions.find(
        (r: { student: { id: string } }) => r.student.id === kids[2].id,
      );
      // Counted at its deadline, which was before the due date.
      expect(row).toMatchObject({
        state: 'on_time',
        score: oneRight(),
        isAutoSubmit: true,
        inProgress: null,
      });
      expect(detail.body.data.counts).toMatchObject({
        assigned: 5,
        onTime: 4,
        pending: 1,
      });

      const get = await http
        .get(`${API}/exams/${id}`)
        .set(auth(kids[2].token))
        .expect(200);
      expect(get.body.data.status).toBe('timed_out');
    });

    it('feeds the question heatmap like any homework', async () => {
      const res = await http
        .get(`${API}/analytics/assignments/${examId}/heatmap`)
        .set(auth(teacherToken))
        .expect(200);
      expect(JSON.stringify(res.body.data)).toContain(kids[2].id);
    });

    it('cannot be started once the teacher closes it', async () => {
      await http
        .patch(`${API}/assignments/${examId}`)
        .set(auth(teacherToken))
        .send({ status: 'closed' })
        .expect(200);
      await start(kids[4]).expect(409);
      const intro = await http
        .get(`${API}/exams/assignments/${examId}`)
        .set(auth(kids[4].token))
        .expect(200);
      expect(intro.body.data).toMatchObject({
        closed: true,
        state: 'not_started',
      });
    });
  });
});
