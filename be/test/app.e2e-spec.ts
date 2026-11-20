import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { tmpdir } from 'node:os';
import request from 'supertest';
import { App } from 'supertest/types.js';

// Must be set before AppModule is imported (ConfigModule validates on import).
process.env.MONGODB_URI = 'memory';
process.env.JWT_SECRET = 'e2e-test-secret-at-least-16-chars';
process.env.SEED_DEMO_DATA = 'true';
process.env.AUTH_RATE_LIMIT = '1000';
process.env.AUTH_IP_RATE_LIMIT = '1000';
// Uploads go to a throwaway folder, never into the repository.
process.env.UPLOAD_DIR = `${tmpdir()}/enquiz-e2e-${process.pid}`;

const { AppModule } = await import('../src/app.module.js');
const { setupApp } = await import('../src/common/setup-app.js');

const API = '/api/v1';

describe('EnQuiz API — phase 1-2 flow (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let adminToken: string;
  let teacherToken: string;
  let teacherQuizId: string;
  let studentToken: string;
  let otherStudentToken: string;
  let mcId: string;
  let matchingId: string;
  let quizId: string;
  let attemptId: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    http = request(app.getHttpServer());
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('health is public', async () => {
    const res = await http.get(`${API}/health`).expect(200);
    expect(res.body).toEqual({
      success: true,
      data: { status: 'ok', clientIp: expect.any(String) },
    });
  });

  describe('auth', () => {
    it('registers a teacher and students', async () => {
      const t = await http
        .post(`${API}/auth/register`)
        .send({
          username: 'CoHoa',
          password: 'secret123',
          fullName: 'Cô Hoa',
          role: 'teacher',
        })
        .expect(201);
      expect(t.body.data.user).toMatchObject({
        username: 'cohoa',
        role: 'teacher',
        status: 'pending',
      });
      expect(t.body.data.user.password).toBeUndefined();
      teacherToken = t.body.data.accessToken;

      const s = await http
        .post(`${API}/auth/register`)
        .send({
          username: 'be_minh',
          password: 'secret123',
          fullName: 'Bé Minh',
          role: 'student',
          gradeLevel: 5,
        })
        .expect(201);
      expect(s.body.data.user.studentProfile).toMatchObject({
        gradeLevel: 5,
        level: 1,
        xp: 0,
      });
      studentToken = s.body.data.accessToken;

      const o = await http
        .post(`${API}/auth/register`)
        .send({
          username: 'be_lan',
          password: 'secret123',
          fullName: 'Bé Lan',
          role: 'student',
          gradeLevel: 5,
        })
        .expect(201);
      otherStudentToken = o.body.data.accessToken;
    });

    it('rejects admin self-registration, duplicate usernames and students without a grade', async () => {
      await http
        .post(`${API}/auth/register`)
        .send({
          username: 'hacker',
          password: 'secret123',
          fullName: 'X',
          role: 'admin',
        })
        .expect(400);
      const dup = await http
        .post(`${API}/auth/register`)
        .send({
          username: 'cohoa',
          password: 'secret123',
          fullName: 'X',
          role: 'teacher',
        })
        .expect(409);
      expect(dup.body).toMatchObject({ success: false, statusCode: 409 });
      await http
        .post(`${API}/auth/register`)
        .send({
          username: 'nograde',
          password: 'secret123',
          fullName: 'X',
          role: 'student',
        })
        .expect(400);
    });

    it('logs in, rejects bad passwords, protects routes', async () => {
      await http
        .post(`${API}/auth/login`)
        .send({ username: 'cohoa', password: 'secret123' })
        .expect(200);
      await http
        .post(`${API}/auth/login`)
        .send({ username: 'cohoa', password: 'wrong' })
        .expect(401);
      await http.get(`${API}/users/profile`).expect(401);
      const me = await http
        .get(`${API}/users/profile`)
        .set(auth(studentToken))
        .expect(200);
      expect(me.body.data.fullName).toBe('Bé Minh');
    });

    it('keeps a new teacher waiting until an admin approves', async () => {
      const blocked = await http
        .get(`${API}/questions`)
        .set(auth(teacherToken))
        .expect(403);
      expect(blocked.body.message).toContain('chờ quản trị viên duyệt');
      const me = await http
        .get(`${API}/users/profile`)
        .set(auth(teacherToken))
        .expect(200);
      expect(me.body.data.status).toBe('pending');

      adminToken = (
        await http
          .post(`${API}/auth/login`)
          .send({ username: 'admin', password: 'admin123' })
          .expect(200)
      ).body.data.accessToken;
      const pending = await http
        .get(`${API}/admin/users?role=teacher&status=pending`)
        .set(auth(adminToken))
        .expect(200);
      expect(
        pending.body.data.items.map((u: { username: string }) => u.username),
      ).toEqual(['cohoa']);
      await http.get(`${API}/admin/users`).set(auth(teacherToken)).expect(403);

      await http
        .patch(`${API}/admin/users/${me.body.data.id}/status`)
        .set(auth(adminToken))
        .send({ status: 'active' })
        .expect(200);
      await http.get(`${API}/questions`).set(auth(teacherToken)).expect(200);
    });

    it('seeds demo accounts when SEED_DEMO_DATA=true', async () => {
      const res = await http
        .post(`${API}/auth/login`)
        .send({ username: 'student', password: 'student123' })
        .expect(200);
      expect(res.body.data.user.role).toBe('student');
    });
  });

  describe('question bank', () => {
    it('is closed to students', async () => {
      await http.get(`${API}/questions`).set(auth(studentToken)).expect(403);
    });

    it('validates type-specific rules', async () => {
      const res = await http
        .post(`${API}/questions`)
        .set(auth(teacherToken))
        .send({
          topic: 'Animals',
          gradeLevel: 5,
          type: 'multiple_choice',
          questionText: 'Pick one',
          options: ['Dog', 'Cat'],
          correctAnswer: 'Bird',
        })
        .expect(400);
      expect(res.body.message).toContain('Đáp án đúng');

      await http
        .post(`${API}/questions`)
        .set(auth(teacherToken))
        .send({
          topic: 'Animals',
          gradeLevel: 5,
          type: 'ordering',
          questionText: 'Not authorable yet',
        })
        .expect(400);
    });

    it('creates multiple choice and matching questions', async () => {
      const mc = await http
        .post(`${API}/questions`)
        .set(auth(teacherToken))
        .send({
          topic: 'Animals',
          gradeLevel: 5,
          type: 'multiple_choice',
          questionText: '🐶 What animal is this?',
          options: ['Dog', 'Cat', 'Duck'],
          correctAnswer: 'dog',
          explanation: 'Dog = con chó',
        })
        .expect(201);
      expect(mc.body.data.correctAnswer).toBe('Dog'); // normalised to the option
      mcId = mc.body.data.id;

      const matching = await http
        .post(`${API}/questions`)
        .set(auth(teacherToken))
        .send({
          topic: 'Animals',
          gradeLevel: 5,
          type: 'matching',
          questionText: 'Match',
          pairs: [
            { left: '🐶', right: 'dog' },
            { left: '🐱', right: 'cat' },
          ],
        })
        .expect(201);
      matchingId = matching.body.data.id;

      const list = await http
        .get(`${API}/questions?mine=true&topic=animals`)
        .set(auth(teacherToken))
        .expect(200);
      expect(list.body.data.total).toBe(2);
    });
  });

  describe('quizzes', () => {
    it('creates a quiz from bank questions', async () => {
      await http
        .post(`${API}/quizzes`)
        .set(auth(teacherToken))
        .send({
          title: 'Bad',
          topic: 'Animals',
          gradeLevel: 5,
          questionIds: ['64b000000000000000000000'],
        })
        .expect(400);

      const teacherQuiz = await http
        .post(`${API}/quizzes`)
        .set(auth(teacherToken))
        .send({
          title: 'Bài của cô Hoa',
          topic: 'Animals',
          gradeLevel: 5,
          questionIds: [mcId, matchingId],
        })
        .expect(201);
      expect(teacherQuiz.body.data).toMatchObject({
        questionCount: 2,
        status: 'published',
        author: { fullName: 'Cô Hoa' },
      });
      teacherQuizId = teacherQuiz.body.data.id;

      // Admin quizzes are system quizzes: stations on the quest map.
      const res = await http
        .post(`${API}/quizzes`)
        .set(auth(adminToken))
        .send({
          title: 'Con vật quanh em',
          topic: 'Animals',
          gradeLevel: 5,
          coverEmoji: '🐾',
          questionIds: [mcId, matchingId],
        })
        .expect(201);
      expect(res.body.data).toMatchObject({ questionCount: 2, author: null });
      quizId = res.body.data.id;
    });

    it('lets students list and play it without leaking answers', async () => {
      const list = await http
        .get(`${API}/quizzes`)
        .set(auth(studentToken))
        .expect(200);
      const ids = list.body.data.items.map((q: { id: string }) => q.id);
      expect(ids).toContain(quizId);
      // A teacher quiz reaches students only as homework (plan D1).
      expect(ids).not.toContain(teacherQuizId);
      await http
        .get(`${API}/quizzes/${teacherQuizId}/play`)
        .set(auth(studentToken))
        .expect(404);

      await http
        .get(`${API}/quizzes/${quizId}`)
        .set(auth(studentToken))
        .expect(403);

      const play = await http
        .get(`${API}/quizzes/${quizId}/play`)
        .set(auth(studentToken))
        .expect(200);
      const raw = JSON.stringify(play.body);
      expect(raw).not.toContain('correctAnswer');
      expect(raw).not.toContain('pairs');
      expect(raw).not.toContain('explanation');
      const matching = play.body.data.questions.find(
        (q: { id: string }) => q.id === matchingId,
      );
      expect(matching.matching.lefts).toEqual(['🐶', '🐱']);
      expect(
        [...matching.matching.rights].sort((a: string, b: string) =>
          a.localeCompare(b),
        ),
      ).toEqual(['cat', 'dog']);
    });

    it('hides drafts from students', async () => {
      const draft = await http
        .post(`${API}/quizzes`)
        .set(auth(teacherToken))
        .send({
          title: 'Draft',
          topic: 'Animals',
          gradeLevel: 5,
          questionIds: [mcId],
          status: 'draft',
        })
        .expect(201);
      await http
        .get(`${API}/quizzes/${draft.body.data.id}/play`)
        .set(auth(studentToken))
        .expect(404);
    });
  });

  describe('progress: sessions, quest map, levels, XP', () => {
    let quiz2Id: string;
    let sessionId: string;
    const wrongMatch = [
      { left: '🐶', right: 'cat' },
      { left: '🐱', right: 'dog' },
    ];
    const rightMatch = [
      { left: '🐱', right: 'cat' },
      { left: '🐶', right: 'dog' },
    ];

    const start = async (token: string, id = quizId) =>
      (
        await http
          .post(`${API}/progress/sessions`)
          .set(auth(token))
          .send({ quizId: id })
          .expect(200)
      ).body.data;
    const answer = (
      token: string,
      sid: string,
      questionId: string,
      studentAnswer: unknown,
    ) =>
      http
        .post(`${API}/progress/sessions/${sid}/answers`)
        .set(auth(token))
        .send({ questionId, studentAnswer });
    const finish = async (token: string, sid: string) =>
      (
        await http
          .post(`${API}/progress/sessions/${sid}/finish`)
          .set(auth(token))
          .expect(201)
      ).body.data;

    it('locks the next station until the previous one is passed', async () => {
      const q2 = await http
        .post(`${API}/quizzes`)
        .set(auth(adminToken))
        .send({
          title: 'Trạm 2',
          topic: 'Animals',
          gradeLevel: 5,
          questionIds: [mcId],
        })
        .expect(201);
      quiz2Id = q2.body.data.id;

      const map = await http
        .get(`${API}/progress/map`)
        .set(auth(studentToken))
        .expect(200);
      expect(map.body.data).toMatchObject({
        gradeLevel: 5,
        level: 1,
        xp: 0,
        passScore: 60,
      });
      expect(
        map.body.data.stations.map((s: { id: string; status: string }) => [
          s.id,
          s.status,
        ]),
      ).toEqual([
        [quizId, 'unlocked'],
        [quiz2Id, 'locked'],
      ]);

      await http
        .get(`${API}/quizzes/${quiz2Id}/play`)
        .set(auth(studentToken))
        .expect(403);
      await http
        .post(`${API}/progress/sessions`)
        .set(auth(studentToken))
        .send({ quizId: quiz2Id })
        .expect(403);
      // Teachers are never gated (preview).
      await http
        .get(`${API}/quizzes/${quiz2Id}/play`)
        .set(auth(teacherToken))
        .expect(200);
    });

    it('gives instant feedback, keeps the first answer and resumes the session', async () => {
      await http
        .post(`${API}/progress/sessions`)
        .set(auth(teacherToken))
        .send({ quizId })
        .expect(403);

      const session = await start(studentToken);
      expect(session.answers).toEqual([]);
      sessionId = session.sessionId;

      const wrong = await answer(studentToken, sessionId, mcId, 'Duck').expect(
        200,
      );
      expect(wrong.body.data).toMatchObject({
        isCorrect: false,
        correctAnswer: 'Dog',
        explanation: 'Dog = con chó',
        alreadyAnswered: false,
      });

      // Changing the answer after seeing the feedback is not possible.
      const again = await answer(studentToken, sessionId, mcId, 'Dog').expect(
        200,
      );
      expect(again.body.data).toMatchObject({
        isCorrect: false,
        alreadyAnswered: true,
      });

      await answer(
        studentToken,
        sessionId,
        '64b000000000000000000000',
        'x',
      ).expect(400);
      await answer(otherStudentToken, sessionId, mcId, 'Dog').expect(404);

      const resumed = await start(studentToken);
      expect(resumed.sessionId).toBe(sessionId);
      expect(resumed.answers).toHaveLength(1);
    });

    it('below the pass mark: earns XP, no level up', async () => {
      const ok = await answer(
        studentToken,
        sessionId,
        matchingId,
        rightMatch,
      ).expect(200);
      expect(ok.body.data.isCorrect).toBe(true);

      const result = await finish(studentToken, sessionId);
      expect(result).toMatchObject({
        score: 50,
        correctCount: 1,
        totalQuestions: 2,
      });
      expect(result.progression).toEqual({
        passed: false,
        xpEarned: 50,
        leveledUp: false,
        levelAfter: 1,
        totalXp: 50,
        unlockedQuiz: null,
      });
      expect(result.durationSec).toBeGreaterThanOrEqual(0);
      attemptId = result.attemptId;

      // The session is consumed: finishing twice cannot save two attempts.
      await http
        .post(`${API}/progress/sessions/${sessionId}/finish`)
        .set(auth(studentToken))
        .expect(404);
    });

    it('passing levels up, unlocks the next station; replays give XP only for improvement', async () => {
      const s = await start(studentToken);
      expect(s.sessionId).not.toBe(sessionId);
      await answer(studentToken, s.sessionId, mcId, 'dog').expect(200);
      await answer(studentToken, s.sessionId, matchingId, rightMatch).expect(
        200,
      );
      const passed = await finish(studentToken, s.sessionId);
      expect(passed.score).toBe(100);
      expect(passed.progression).toEqual({
        passed: true,
        xpEarned: 50,
        leveledUp: true,
        levelAfter: 2,
        totalXp: 100,
        unlockedQuiz: { id: quiz2Id, title: 'Trạm 2', coverEmoji: '📘' },
      });

      const map = await http
        .get(`${API}/progress/map`)
        .set(auth(studentToken))
        .expect(200);
      expect(map.body.data).toMatchObject({ level: 2, xp: 100 });
      expect(
        map.body.data.stations.map((st: { status: string }) => st.status),
      ).toEqual(['passed', 'unlocked']);
      expect(map.body.data.stations[0].bestScore).toBe(100);
      await http
        .get(`${API}/quizzes/${quiz2Id}/play`)
        .set(auth(studentToken))
        .expect(200);

      const replay = await start(studentToken);
      await answer(studentToken, replay.sessionId, mcId, 'Dog').expect(200);
      await answer(
        studentToken,
        replay.sessionId,
        matchingId,
        wrongMatch,
      ).expect(200);
      const r = await finish(studentToken, replay.sessionId);
      expect(r.progression).toMatchObject({
        xpEarned: 0,
        leveledUp: false,
        levelAfter: 2,
      });

      const me = await http
        .get(`${API}/users/profile`)
        .set(auth(studentToken))
        .expect(200);
      expect(me.body.data.studentProfile).toEqual({
        gradeLevel: 5,
        level: 2,
        xp: 100,
      });
    });

    it('counts unanswered questions as wrong', async () => {
      const s = await start(otherStudentToken);
      await answer(otherStudentToken, s.sessionId, mcId, 'Dog').expect(200);
      const result = await finish(otherStudentToken, s.sessionId);
      expect(result).toMatchObject({ score: 50, correctCount: 1 });
      expect(result.details[1]).toMatchObject({
        studentAnswer: null,
        isCorrect: false,
      });
    });

    it('ranks students of a grade by XP', async () => {
      for (const period of ['week', 'month', 'all']) {
        const res = await http
          .get(`${API}/progress/leaderboard?period=${period}`)
          .set(auth(studentToken))
          .expect(200);
        expect(res.body.data.gradeLevel).toBe(5);
        expect(
          res.body.data.entries.map(
            (e: { fullName: string; xp: number; rank: number }) => [
              e.rank,
              e.fullName,
              e.xp,
            ],
          ),
        ).toEqual([
          [1, 'Bé Minh', 100], // the student's own name stays in full
          [2, 'Lan B.', 50], // others are shortened across the grade
        ]);
        expect(res.body.data.me).toMatchObject({ rank: 1, level: 2 });
      }

      const teacherView = await http
        .get(`${API}/progress/leaderboard?gradeLevel=5`)
        .set(auth(teacherToken))
        .expect(200);
      expect(teacherView.body.data.entries).toHaveLength(2);
      expect(teacherView.body.data.me).toBeNull();

      await http
        .get(`${API}/progress/leaderboard?period=year`)
        .set(auth(studentToken))
        .expect(400);
    });

    it('shows history and attempt detail to the right people', async () => {
      const history = await http
        .get(`${API}/progress/history`)
        .set(auth(studentToken))
        .expect(200);
      expect(history.body.data).toHaveLength(3);
      expect(history.body.data[2]).toMatchObject({
        attemptId,
        score: 50,
        passed: false,
        xpEarned: 50,
      });

      const detail = await http
        .get(`${API}/progress/attempts/${attemptId}`)
        .set(auth(studentToken))
        .expect(200);
      expect(detail.body.data.progression).toMatchObject({
        xpEarned: 50,
        totalXp: null,
      });
      await http
        .get(`${API}/progress/attempts/${attemptId}`)
        .set(auth(adminToken))
        .expect(200);
      // Not the quiz author and not the student's class teacher.
      await http
        .get(`${API}/progress/attempts/${attemptId}`)
        .set(auth(teacherToken))
        .expect(404);
      await http
        .get(`${API}/progress/attempts/${attemptId}`)
        .set(auth(otherStudentToken))
        .expect(404);
    });

    it('gives the quiz author a results table', async () => {
      const res = await http
        .get(`${API}/progress/quiz/${quizId}`)
        .set(auth(adminToken))
        .expect(200);
      expect(res.body.data).toHaveLength(4);
      const names = new Set(
        res.body.data.map(
          (r: { student: { fullName: string } }) => r.student.fullName,
        ),
      );
      expect(names).toEqual(new Set(['Bé Lan', 'Bé Minh']));
    });
  });

  it('refuses to delete a question that a quiz uses', async () => {
    await http
      .delete(`${API}/questions/${mcId}`)
      .set(auth(teacherToken))
      .expect(409);
  });
});
