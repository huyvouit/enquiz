import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { Connection } from 'mongoose';
import { Types } from 'mongoose';
import { tmpdir } from 'node:os';
import request from 'supertest';
import { App } from 'supertest/types.js';
import ExcelJS from 'exceljs';

// Must be set before AppModule is imported (ConfigModule validates on import).
process.env.MONGODB_URI = 'memory';
process.env.JWT_SECRET = 'e2e-test-secret-at-least-16-chars';
process.env.SEED_DEMO_DATA = 'true';
process.env.AUTH_RATE_LIMIT = '1000';
// Uploads go to a throwaway folder, never into the repository.
process.env.UPLOAD_DIR = `${tmpdir()}/enquiz-e2e-${process.pid}`;

const { AppModule } = await import('../src/app.module.js');
const { setupApp } = await import('../src/common/setup-app.js');

const API = '/api/v1';
const HOUR = 3600_000;

describe('EnQuiz API — phase 3: classes & homework (e2e)', () => {
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

  let adminToken: string;
  let teacherToken: string;
  let otherTeacherToken: string;
  let demoStudentToken: string;
  let classId: string;
  let classCode: string;
  let groupId: string;
  const kids: { id: string; username: string; token: string }[] = [];
  let quizId: string;
  let questionId: string;
  let groupHomeworkId: string;
  let classHomeworkId: string;
  let homeworkAttemptId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app);
    await app.init();
    http = request(app.getHttpServer());
    db = app.get<Connection>(getConnectionToken());

    adminToken = await login('admin', 'admin123');
    teacherToken = await login('teacher', 'teacher123');
    demoStudentToken = await login('student', 'student123');
    const t2 = await http
      .post(`${API}/auth/register`)
      .send({
        username: 'cothu',
        password: 'secret123',
        fullName: 'Cô Thu',
        role: 'teacher',
      })
      .expect(201);
    otherTeacherToken = t2.body.data.accessToken;
    await http
      .patch(`${API}/admin/users/${t2.body.data.user.id}/status`)
      .set(auth(adminToken))
      .send({ status: 'active' })
      .expect(200);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  describe('classes', () => {
    it('creates a class with an invite code that only its teacher can open', async () => {
      const res = await http
        .post(`${API}/classes`)
        .set(auth(teacherToken))
        .send({ name: 'Lớp 1A', gradeLevel: 1, schoolName: 'TH Hoà Bình' })
        .expect(201);
      expect(res.body.data).toMatchObject({
        name: 'Lớp 1A',
        studentCount: 0,
        status: 'active',
      });
      expect(res.body.data.code).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
      classId = res.body.data.id;
      classCode = res.body.data.code;

      await http
        .get(`${API}/classes/${classId}`)
        .set(auth(otherTeacherToken))
        .expect(404);
      await http
        .post(`${API}/classes`)
        .set(auth(demoStudentToken))
        .send({ name: 'X', gradeLevel: 1 })
        .expect(403);
    });

    it('lets a student join with the code (case and spaces ignored)', async () => {
      const typed = `${classCode.slice(0, 3).toLowerCase()} ${classCode.slice(3)}`;
      const joined = await http
        .post(`${API}/classes/join`)
        .set(auth(demoStudentToken))
        .send({ code: typed })
        .expect(200);
      expect(joined.body.data).toMatchObject({
        id: classId,
        name: 'Lớp 1A',
        teacherName: 'Cô Lan',
      });
      expect(joined.body.data.code).toBeUndefined();
      await http
        .post(`${API}/classes/join`)
        .set(auth(demoStudentToken))
        .send({ code: classCode })
        .expect(200);
      await http
        .post(`${API}/classes/join`)
        .set(auth(demoStudentToken))
        .send({ code: 'ZZZZZZ' })
        .expect(404);

      const mine = await http
        .get(`${API}/classes`)
        .set(auth(demoStudentToken))
        .expect(200);
      expect(mine.body.data).toHaveLength(1);
    });

    it('creates student accounts in bulk with readable usernames and passwords', async () => {
      const res = await http
        .post(`${API}/classes/${classId}/students/bulk`)
        .set(auth(teacherToken))
        .send({ fullNames: ['Nguyễn Minh Anh', 'Trần Minh Anh', ' Lê   Bảo '] })
        .expect(201);
      const created = res.body.data.created as {
        id: string;
        fullName: string;
        username: string;
        password: string;
      }[];
      expect(created.map((c) => [c.fullName, c.username])).toEqual([
        ['Nguyễn Minh Anh', 'minhanh'],
        ['Trần Minh Anh', 'minhanh2'],
        ['Lê Bảo', 'bao'],
      ]);
      for (const c of created) expect(c.password).toMatch(/^[a-z]+\d{2}$/);
      expect(res.body.data.class.studentCount).toBe(4);

      for (const c of created) {
        kids.push({
          id: c.id,
          username: c.username,
          token: await login(c.username, c.password),
        });
      }
    });

    it('manages groups made of class members only', async () => {
      const outsider = await http
        .post(`${API}/classes/${classId}/groups`)
        .set(auth(teacherToken))
        .send({
          name: 'Nhóm lạ',
          studentIds: [new Types.ObjectId().toString()],
        })
        .expect(400);
      expect(outsider.body.message).toContain('học sinh của lớp');

      const group = await http
        .post(`${API}/classes/${classId}/groups`)
        .set(auth(teacherToken))
        .send({ name: 'Nhóm cần kèm', studentIds: [kids[0].id] })
        .expect(201);
      groupId = group.body.data.id;

      const detail = await http
        .get(`${API}/classes/${classId}`)
        .set(auth(teacherToken))
        .expect(200);
      expect(detail.body.data.groups).toEqual([
        { id: groupId, name: 'Nhóm cần kèm', studentIds: [kids[0].id] },
      ]);
      expect(detail.body.data.students).toHaveLength(4);
    });

    it('lets the teacher reset a password only for their own students', async () => {
      const reset = await http
        .post(`${API}/classes/${classId}/students/${kids[2].id}/reset-password`)
        .set(auth(teacherToken))
        .expect(200);
      kids[2].token = await login('bao', reset.body.data.temporaryPassword);

      await http
        .post(`${API}/classes/${classId}/students/${kids[2].id}/reset-password`)
        .set(auth(otherTeacherToken))
        .expect(404);
    });
  });

  describe('homework', () => {
    it('assigns a draft quiz to a group and to the whole class', async () => {
      const q = await http
        .post(`${API}/questions`)
        .set(auth(teacherToken))
        .send({
          topic: 'Animals',
          gradeLevel: 1,
          type: 'multiple_choice',
          questionText: '🐱 What is it?',
          options: ['Cat', 'Dog'],
          correctAnswer: 'Cat',
        })
        .expect(201);
      questionId = q.body.data.id;
      const quiz = await http
        .post(`${API}/quizzes`)
        .set(auth(teacherToken))
        .send({
          title: 'Bài về nhà: Mèo',
          topic: 'Animals',
          gradeLevel: 1,
          questionIds: [questionId],
          status: 'draft',
        })
        .expect(201);
      quizId = quiz.body.data.id;

      const tomorrow = new Date(Date.now() + 24 * HOUR).toISOString();
      await http
        .post(`${API}/classes/${classId}/assignments`)
        .set(auth(teacherToken))
        .send({
          quizId,
          target: { kind: 'class' },
          dueDate: new Date(Date.now() - HOUR).toISOString(),
        })
        .expect(400);
      await http
        .post(`${API}/classes/${classId}/assignments`)
        .set(auth(otherTeacherToken))
        .send({ quizId, target: { kind: 'class' }, dueDate: tomorrow })
        .expect(404);

      const toGroup = await http
        .post(`${API}/classes/${classId}/assignments`)
        .set(auth(teacherToken))
        .send({
          quizId,
          target: { kind: 'group', groupId },
          dueDate: tomorrow,
          note: 'Làm cẩn thận nhé!',
        })
        .expect(201);
      expect(toGroup.body.data).toMatchObject({
        target: { kind: 'group', groupName: 'Nhóm cần kèm' },
        counts: { assigned: 1, onTime: 0, late: 0, pending: 1, missing: 0 },
        averageScore: null,
      });
      groupHomeworkId = toGroup.body.data.id;

      const toClass = await http
        .post(`${API}/classes/${classId}/assignments`)
        .set(auth(teacherToken))
        .send({ quizId, target: { kind: 'class' }, dueDate: tomorrow })
        .expect(201);
      expect(toClass.body.data.counts.assigned).toBe(4);
      classHomeworkId = toClass.body.data.id;
    });

    it('shows homework and reminders to the right students', async () => {
      const mine = await http
        .get(`${API}/assignments/mine`)
        .set(auth(kids[0].token))
        .expect(200);
      expect(mine.body.data).toHaveLength(2);
      expect(mine.body.data[0]).toMatchObject({
        className: 'Lớp 1A',
        teacherName: 'Cô Lan',
        state: 'pending',
        dueSoon: true,
        isNew: true,
        quiz: { id: quizId, title: 'Bài về nhà: Mèo' },
      });

      const reminders = await http
        .get(`${API}/assignments/mine/reminders`)
        .set(auth(kids[0].token))
        .expect(200);
      expect(reminders.body.data.pendingCount).toBe(2);
      expect(reminders.body.data.dueSoon).toHaveLength(2);
      expect(reminders.body.data.overdue).toHaveLength(0);

      const notInGroup = await http
        .get(`${API}/assignments/mine`)
        .set(auth(kids[1].token))
        .expect(200);
      expect(notInGroup.body.data.map((a: { id: string }) => a.id)).toEqual([
        classHomeworkId,
      ]);
    });

    it('plays homework through the assignment, never through the map', async () => {
      // The draft teacher quiz is readable because it is homework...
      await http
        .get(`${API}/quizzes/${quizId}/play`)
        .set(auth(kids[0].token))
        .expect(200);
      // ...but it is not a quest-map station.
      await http
        .post(`${API}/progress/sessions`)
        .set(auth(kids[0].token))
        .send({ quizId })
        .expect(404);
      // Not given to this student.
      await http
        .post(`${API}/progress/sessions`)
        .set(auth(kids[1].token))
        .send({ quizId, assignmentId: groupHomeworkId })
        .expect(404);

      const session = await http
        .post(`${API}/progress/sessions`)
        .set(auth(kids[0].token))
        .send({ quizId, assignmentId: groupHomeworkId })
        .expect(200);
      await http
        .post(`${API}/progress/sessions/${session.body.data.sessionId}/answers`)
        .set(auth(kids[0].token))
        .send({ questionId, studentAnswer: 'Cat' })
        .expect(200);
      const result = await http
        .post(`${API}/progress/sessions/${session.body.data.sessionId}/finish`)
        .set(auth(kids[0].token))
        .expect(201);
      expect(result.body.data.score).toBe(100);
      homeworkAttemptId = result.body.data.attemptId;

      // The same quiz as another homework is a separate session.
      const other = await http
        .post(`${API}/progress/sessions`)
        .set(auth(kids[0].token))
        .send({ quizId, assignmentId: classHomeworkId })
        .expect(200);
      expect(other.body.data.answers).toEqual([]);
    });

    it('classifies submissions: on time, late, not submitted', async () => {
      const detail = await http
        .get(`${API}/assignments/${groupHomeworkId}`)
        .set(auth(teacherToken))
        .expect(200);
      expect(detail.body.data.className).toBe('Lớp 1A');
      expect(detail.body.data.submissions).toEqual([
        expect.objectContaining({
          student: expect.objectContaining({ username: 'minhanh' }),
          state: 'on_time',
          score: 100,
          attempts: 1,
          attemptId: homeworkAttemptId,
        }),
      ]);

      // The class teacher may open the attempt review of their student.
      await http
        .get(`${API}/progress/attempts/${homeworkAttemptId}`)
        .set(auth(teacherToken))
        .expect(200);

      // Move the due date before the attempt: the same data becomes "late",
      // and nobody else submitted the class homework: "missing".
      const past = new Date(Date.now() - 2 * HOUR);
      await db.collection('assignments').updateMany(
        {
          _id: {
            $in: [groupHomeworkId, classHomeworkId].map(
              (id) => new Types.ObjectId(id),
            ),
          },
        },
        { $set: { dueDate: past } },
      );
      const late = await http
        .get(`${API}/assignments/${groupHomeworkId}`)
        .set(auth(teacherToken))
        .expect(200);
      expect(late.body.data.submissions[0].state).toBe('late');

      const list = await http
        .get(`${API}/classes/${classId}/assignments`)
        .set(auth(teacherToken))
        .expect(200);
      const classRow = list.body.data.find(
        (a: { id: string }) => a.id === classHomeworkId,
      );
      expect(classRow.counts).toEqual({
        assigned: 4,
        onTime: 0,
        late: 0,
        pending: 0,
        missing: 4,
      });

      const reminders = await http
        .get(`${API}/assignments/mine/reminders`)
        .set(auth(kids[1].token))
        .expect(200);
      expect(reminders.body.data.overdue).toHaveLength(1);
      expect(reminders.body.data.dueSoon).toHaveLength(0);
    });

    it('lets the teacher extend, close and reopen homework', async () => {
      const extended = await http
        .patch(`${API}/assignments/${classHomeworkId}`)
        .set(auth(teacherToken))
        .send({ dueDate: new Date(Date.now() + 3 * 24 * HOUR).toISOString() })
        .expect(200);
      expect(extended.body.data.counts.pending).toBe(4);

      await http
        .patch(`${API}/assignments/${classHomeworkId}`)
        .set(auth(teacherToken))
        .send({ status: 'closed' })
        .expect(200);
      await http
        .post(`${API}/progress/sessions`)
        .set(auth(kids[1].token))
        .send({ quizId, assignmentId: classHomeworkId })
        .expect(409);
      await http
        .patch(`${API}/assignments/${classHomeworkId}`)
        .set(auth(teacherToken))
        .send({ status: 'active' })
        .expect(200);
    });

    it('adds late joiners to open whole-class homework and drops leavers', async () => {
      const newbie = await http
        .post(`${API}/auth/register`)
        .send({
          username: 'be_moi',
          password: 'secret123',
          fullName: 'Bé Mới',
          role: 'student',
          gradeLevel: 1,
        })
        .expect(201);
      const newbieToken = newbie.body.data.accessToken;
      await http
        .post(`${API}/classes/join`)
        .set(auth(newbieToken))
        .send({ code: classCode })
        .expect(200);
      const mine = await http
        .get(`${API}/assignments/mine`)
        .set(auth(newbieToken))
        .expect(200);
      // Only the open class homework, not the overdue group one.
      expect(mine.body.data.map((a: { id: string }) => a.id)).toEqual([
        classHomeworkId,
      ]);

      await http
        .delete(`${API}/classes/${classId}/students/${kids[0].id}`)
        .set(auth(teacherToken))
        .expect(200);
      const afterLeave = await http
        .get(`${API}/assignments/mine`)
        .set(auth(kids[0].token))
        .expect(200);
      expect(afterLeave.body.data).toHaveLength(0);
      const detail = await http
        .get(`${API}/classes/${classId}`)
        .set(auth(teacherToken))
        .expect(200);
      expect(detail.body.data.groups[0].studentIds).toEqual([]);
    });
  });

  describe('class leaderboard', () => {
    it('ranks members with full names and is closed to outsiders', async () => {
      const res = await http
        .get(
          `${API}/progress/leaderboard?scope=class&classId=${classId}&period=all`,
        )
        .set(auth(kids[1].token))
        .expect(200);
      expect(res.body.data).toMatchObject({
        scope: 'class',
        classId,
        className: 'Lớp 1A',
      });
      // kids[0] left the class, so their XP is not listed here.
      expect(res.body.data.entries).toEqual([]);

      await http
        .get(`${API}/progress/leaderboard?scope=class&classId=${classId}`)
        .set(auth(kids[0].token))
        .expect(404);
      await http
        .get(`${API}/progress/leaderboard?scope=class`)
        .set(auth(kids[1].token))
        .expect(400);
      await http
        .get(`${API}/progress/leaderboard?scope=class&classId=${classId}`)
        .set(auth(teacherToken))
        .expect(200);
    });
  });

  describe('teacher analytics', () => {
    let classB: string;
    let homework: string;
    let quiz: string;
    const qIds: string[] = [];
    const pupils: { id: string; token: string }[] = [];
    const binary = (
      res: request.Response,
      cb: (e: Error | null, b: Buffer) => void,
    ) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    };

    const play = async (
      token: string,
      answers: (string | null)[],
    ): Promise<number> => {
      const s = await http
        .post(`${API}/progress/sessions`)
        .set(auth(token))
        .send({ quizId: quiz, assignmentId: homework })
        .expect(200);
      for (let i = 0; i < qIds.length; i++) {
        if (answers[i] === null) continue; // left blank
        await http
          .post(`${API}/progress/sessions/${s.body.data.sessionId}/answers`)
          .set(auth(token))
          .send({ questionId: qIds[i], studentAnswer: answers[i] })
          .expect(200);
      }
      const done = await http
        .post(`${API}/progress/sessions/${s.body.data.sessionId}/finish`)
        .set(auth(token))
        .expect(201);
      return done.body.data.score as number;
    };

    beforeAll(async () => {
      const c = await http
        .post(`${API}/classes`)
        .set(auth(teacherToken))
        .send({ name: 'Lớp 2B', gradeLevel: 1 })
        .expect(201);
      classB = c.body.data.id;
      const bulk = await http
        .post(`${API}/classes/${classB}/students/bulk`)
        .set(auth(teacherToken))
        .send({ fullNames: ['Phạm An', 'Vũ Bình', 'Đỗ Chi'] })
        .expect(201);
      for (const k of bulk.body.data.created) {
        pupils.push({ id: k.id, token: await login(k.username, k.password) });
      }
      for (const [text, answer] of [
        ['🐶 dog or cat?', 'Cat'],
        ['🐱 cat or dog?', 'Cat'],
        ['🐦 bird or fish?', 'Bird'],
        ['🐟 fish or bird?', 'Fish'],
      ]) {
        const options = text.includes('dog')
          ? ['Dog', 'Cat']
          : ['Bird', 'Fish'];
        const q = await http
          .post(`${API}/questions`)
          .set(auth(teacherToken))
          .send({
            topic: 'Animals',
            gradeLevel: 1,
            type: 'multiple_choice',
            questionText: text,
            options,
            correctAnswer: answer,
          })
          .expect(201);
        qIds.push(q.body.data.id);
      }
      const qz = await http
        .post(`${API}/quizzes`)
        .set(auth(teacherToken))
        .send({
          title: 'Con vật',
          topic: 'Animals',
          gradeLevel: 1,
          questionIds: qIds,
        })
        .expect(201);
      quiz = qz.body.data.id;
      const hw = await http
        .post(`${API}/classes/${classB}/assignments`)
        .set(auth(teacherToken))
        .send({
          quizId: quiz,
          target: { kind: 'class' },
          dueDate: new Date(Date.now() + 24 * HOUR).toISOString(),
        })
        .expect(201);
      homework = hw.body.data.id;

      // An: 2/4 first time (one blank), then 100 on a retry.
      expect(await play(pupils[0].token, ['Cat', 'Dog', 'Bird', null])).toBe(
        50,
      );
      expect(await play(pupils[0].token, ['Cat', 'Cat', 'Bird', 'Fish'])).toBe(
        100,
      );
      // Bình: 2/4, chose "Dog" twice. Chi: never played.
      expect(await play(pupils[1].token, ['Dog', 'Dog', 'Bird', 'Fish'])).toBe(
        50,
      );
    });

    it('builds the question heatmap from first attempts only', async () => {
      const res = await http
        .get(`${API}/analytics/assignments/${homework}/heatmap`)
        .set(auth(teacherToken))
        .expect(200);
      const h = res.body.data;
      expect(h.firstAttemptOnly).toBe(true);
      expect(
        h.questions.map((q: { correctRate: number }) => q.correctRate),
      ).toEqual([50, 0, 100, 50]);
      expect(h.questions[1].commonWrongAnswer).toEqual({
        answer: 'Dog',
        count: 2,
      });
      expect(h.questions[1].correctAnswer).toBe('Cat');
      expect(
        h.rows.map(
          (r: {
            student: { fullName: string };
            score: number | null;
            cells: string[];
          }) => [r.student.fullName, r.score, r.cells],
        ),
      ).toEqual([
        ['Phạm An', 50, ['correct', 'wrong', 'correct', 'skipped']],
        ['Vũ Bình', 50, ['wrong', 'wrong', 'correct', 'correct']],
        ['Đỗ Chi', null, [null, null, null, null]],
      ]);

      const topics = await http
        .get(`${API}/analytics/classes/${classB}/topics`)
        .set(auth(teacherToken))
        .expect(200);
      expect(topics.body.data.cells).toEqual([
        { topic: 'Animals', skill: 'vocabulary', correctRate: 50, answered: 8 },
      ]);
    });

    it('summarises the class and flags students who need attention', async () => {
      const res = await http
        .get(`${API}/analytics/classes/${classB}/overview`)
        .set(auth(teacherToken))
        .expect(200);
      const o = res.body.data;
      expect(o).toMatchObject({
        studentCount: 3,
        activeLast7Days: 2,
        attempts: 3,
        averageScore: 67,
        openAssignments: 1,
        onTimeRate: null, // no deadline has passed yet
      });
      expect(
        o.needsAttention.map(
          (x: { student: { fullName: string }; reasons: string[] }) => [
            x.student.fullName,
            x.reasons,
          ],
        ),
      ).toEqual([
        ['Vũ Bình', ['Điểm TB 50']],
        ['Đỗ Chi', ['Chưa làm bài nào']],
      ]);
    });

    it('reports one student and the class gradebook', async () => {
      const report = await http
        .get(`${API}/analytics/classes/${classB}/students/${pupils[0].id}`)
        .set(auth(teacherToken))
        .expect(200);
      const r = report.body.data;
      expect(r.student).toMatchObject({
        fullName: 'Phạm An',
        level: 2,
        xp: 100,
      });
      expect(r.xpInRange).toBe(100);
      expect(r.homework.counts).toMatchObject({ assigned: 1, onTime: 1 });
      expect(r.map.totalStations).toBeGreaterThan(0);
      expect(r.map.unlocked).toBe(1);
      expect(r.topics).toEqual([
        { topic: 'Animals', correctRate: 50, classRate: 50, answered: 4 },
      ]);
      expect(r.history).toHaveLength(2);
      expect(r.weeklyTrend).toHaveLength(8);
      expect(r.weeklyTrend[7]).toMatchObject({ averageScore: 75, attempts: 2 });

      const chi = await http
        .get(`${API}/analytics/classes/${classB}/students/${pupils[2].id}`)
        .set(auth(teacherToken))
        .expect(200);
      expect(chi.body.data.homework.incomplete).toEqual([
        expect.objectContaining({ quizTitle: 'Con vật', state: 'pending' }),
      ]);

      const gb = await http
        .get(`${API}/analytics/classes/${classB}/gradebook`)
        .set(auth(teacherToken))
        .expect(200);
      expect(gb.body.data.assignments).toHaveLength(1);
      expect(
        gb.body.data.rows.map(
          (x: {
            student: { fullName: string };
            averageScore: number | null;
            average10: number | null;
            notSubmitted: number;
          }) => [
            x.student.fullName,
            x.averageScore,
            x.average10,
            x.notSubmitted,
          ],
        ),
      ).toEqual([
        ['Phạm An', 100, 10, 0],
        ['Vũ Bình', 50, 5, 0],
        ['Đỗ Chi', null, null, 1],
      ]);
      expect(gb.body.data.assignmentAverages).toEqual([75]);
    });

    it('exports Excel and PDF files with the same numbers', async () => {
      const xlsx = await http
        .get(`${API}/analytics/classes/${classB}/gradebook/export?format=xlsx`)
        .set(auth(teacherToken))
        .buffer(true)
        .parse(binary)
        .expect(200);
      expect(xlsx.headers['content-type']).toContain('spreadsheetml');
      expect(xlsx.headers['content-disposition']).toMatch(
        /attachment; filename="bang-diem-lop-2b-\d{4}-\d{2}-\d{2}\.xlsx"/,
      );
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(xlsx.body as never);
      const sheet = wb.getWorksheet('Bảng điểm')!;
      const values = sheet.getRow(5).values as unknown[];
      expect(values.slice(1, 5)).toEqual([1, 'Phạm An', 'phaman', 100]);

      for (const url of [
        `${API}/analytics/classes/${classB}/gradebook/export?format=pdf`,
        `${API}/analytics/assignments/${homework}/export?format=pdf`,
        `${API}/analytics/classes/${classB}/students/${pupils[0].id}/export`,
      ]) {
        const pdf = await http
          .get(url)
          .set(auth(teacherToken))
          .buffer(true)
          .parse(binary)
          .expect(200);
        expect(pdf.headers['content-type']).toBe('application/pdf');
        expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
      }
      const assignmentXlsx = await http
        .get(`${API}/analytics/assignments/${homework}/export?format=xlsx`)
        .set(auth(teacherToken))
        .buffer(true)
        .parse(binary)
        .expect(200);
      const wb2 = new ExcelJS.Workbook();
      await wb2.xlsx.load(assignmentXlsx.body as never);
      expect(wb2.worksheets.map((w) => w.name)).toEqual([
        'Nộp bài',
        'Từng câu',
      ]);
    });

    it('is closed to other teachers and to students', async () => {
      for (const url of [
        `${API}/analytics/classes/${classB}/overview`,
        `${API}/analytics/assignments/${homework}/heatmap`,
        `${API}/analytics/classes/${classB}/gradebook/export?format=pdf`,
      ]) {
        await http.get(url).set(auth(otherTeacherToken)).expect(404);
        await http.get(url).set(auth(pupils[0].token)).expect(403);
      }
      await http
        .get(`${API}/analytics/classes/${classB}/students/${kids[1].id}`)
        .set(auth(teacherToken))
        .expect(404);
    });
  });

  describe('new question types, listening and images', () => {
    const PNG = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    let imageUrl: string;
    const ids: Record<string, string> = {};

    it('uploads images, checking the real file type and size', async () => {
      const ok = await http
        .post(`${API}/uploads/images`)
        .set(auth(teacherToken))
        .attach('file', PNG, 'meo.png')
        .expect(201);
      expect(ok.body.data.url).toMatch(
        /^\/api\/v1\/uploads\/images\/[0-9a-f-]{36}\.png$/,
      );
      imageUrl = ok.body.data.url;
      const served = await http.get(imageUrl).expect(200);
      expect(served.headers['content-type']).toBe('image/png');

      await http
        .post(`${API}/uploads/images`)
        .set(auth(teacherToken))
        .attach('file', Buffer.from('<svg onload="x()"/>'), 'fake.png')
        .expect(415);
      await http
        .post(`${API}/uploads/images`)
        .set(auth(teacherToken))
        .attach(
          'file',
          Buffer.concat([PNG, Buffer.alloc(1024 * 1024)]),
          'big.png',
        )
        .expect(413);
      await http
        .post(`${API}/uploads/images`)
        .set(auth(kids[1].token))
        .attach('file', PNG, 'meo.png')
        .expect(403);
      await http
        .get(`${API}/uploads/images/..%2F..%2Fpackage.json`)
        .expect(404);
    });

    it('authors fill-in-the-blank, ordering and listening questions', async () => {
      const fill = await http
        .post(`${API}/questions`)
        .set(auth(teacherToken))
        .send({
          topic: 'Animals',
          gradeLevel: 1,
          type: 'fill_in_blank',
          questionText: 'I have a ____.',
          acceptedAnswers: ['cat', 'kitten'],
          options: ['cat', 'fish', 'sun'],
          mediaUrl: imageUrl,
        })
        .expect(201);
      expect(fill.body.data).toMatchObject({
        questionText: 'I have a ___.',
        correctAnswer: ['cat', 'kitten'],
        mediaUrl: imageUrl,
      });
      ids.fill = fill.body.data.id;

      const order = await http
        .post(`${API}/questions`)
        .set(auth(teacherToken))
        .send({
          topic: 'Animals',
          gradeLevel: 1,
          type: 'ordering',
          questionText: 'Sắp xếp thành câu đúng',
          orderedItems: ['I', 'like', 'my', 'cat'],
        })
        .expect(201);
      ids.order = order.body.data.id;

      const listen = await http
        .post(`${API}/questions`)
        .set(auth(teacherToken))
        .send({
          topic: 'Animals',
          gradeLevel: 1,
          type: 'multiple_choice',
          questionText: 'Nghe và chọn con vật đúng',
          audioText: 'a duck',
          options: ['🦆', '🐔'],
          correctAnswer: '🦆',
          tags: ['Farm', 'farm', ' Birds '],
          yleLevel: 'starters',
        })
        .expect(201);
      expect(listen.body.data).toMatchObject({
        skill: 'listening',
        audioText: 'a duck',
        tags: ['farm', 'birds'],
        yleLevel: 'starters',
      });
      ids.listen = listen.body.data.id;

      await http
        .post(`${API}/questions`)
        .set(auth(teacherToken))
        .send({
          topic: 'Animals',
          gradeLevel: 1,
          type: 'multiple_choice',
          questionText: 'x',
          options: ['a', 'b'],
          correctAnswer: 'a',
          mediaUrl: 'javascript:alert(1)',
        })
        .expect(400);
    });

    it('plays them without leaking the answer key', async () => {
      const quiz = await http
        .post(`${API}/quizzes`)
        .set(auth(teacherToken))
        .send({
          title: 'Ba dạng mới',
          topic: 'Animals',
          gradeLevel: 1,
          questionIds: [ids.fill, ids.order, ids.listen],
        })
        .expect(201);
      const hw = await http
        .post(`${API}/classes/${classId}/assignments`)
        .set(auth(teacherToken))
        .send({
          quizId: quiz.body.data.id,
          target: { kind: 'students', studentIds: [kids[1].id] },
          dueDate: new Date(Date.now() + 24 * HOUR).toISOString(),
        })
        .expect(201);

      const play = await http
        .get(`${API}/quizzes/${quiz.body.data.id}/play`)
        .set(auth(kids[1].token))
        .expect(200);
      const raw = JSON.stringify(play.body.data);
      expect(raw).not.toContain('correctAnswer');
      expect(raw).not.toContain('kitten');
      const [fq, oq, lq] = play.body.data.questions;
      const byText = (a: string, b: string) => a.localeCompare(b, 'en');
      expect([...fq.options].sort(byText)).toEqual(['cat', 'fish', 'sun']);
      expect([...oq.ordering.items].sort(byText)).toEqual([
        'cat',
        'I',
        'like',
        'my',
      ]);
      expect(oq.ordering.items).not.toEqual(['I', 'like', 'my', 'cat']);
      expect(lq.audioText).toBe('a duck');

      const s = await http
        .post(`${API}/progress/sessions`)
        .set(auth(kids[1].token))
        .send({ quizId: quiz.body.data.id, assignmentId: hw.body.data.id })
        .expect(200);
      const answer = (questionId: string, studentAnswer: unknown) =>
        http
          .post(`${API}/progress/sessions/${s.body.data.sessionId}/answers`)
          .set(auth(kids[1].token))
          .send({ questionId, studentAnswer })
          .expect(200);
      expect((await answer(ids.fill, ' KITTEN ')).body.data.isCorrect).toBe(
        true,
      );
      const wrongOrder = await answer(ids.order, ['my', 'cat', 'I', 'like']);
      expect(wrongOrder.body.data).toMatchObject({
        isCorrect: false,
        correctAnswer: ['I', 'like', 'my', 'cat'],
      });
      expect((await answer(ids.listen, '🦆')).body.data.isCorrect).toBe(true);
    });
  });

  describe('CSV import and quest-map order', () => {
    const csv = [
      'type,topic,gradeLevel,questionText,options,correctAnswer,pairs',
      'mc,Colors,1,🔴 What color?,red|blue,red,',
      'fill,Colors,1,The sky is ___.,,blue|light blue,',
      'order,Colors,1,Sắp xếp,,I|like|green,',
      'matching,Colors,1,Nối,,,🔴=red|🔵=blue',
      'mc,Colors,1,🔴 What color?,red|blue,red,',
      'mc,Colors,9,Bad grade,a|b,a,',
      'mc,Colors,1,Answer missing,a|b,c,',
      'fill,Colors,1,No blank here,,x,',
    ].join('\n');

    it('dry-runs with per-row errors, then imports the valid rows once', async () => {
      const dry = await http
        .post(`${API}/questions/import?dryRun=true`)
        .set(auth(teacherToken))
        .send({ csv })
        .expect(200);
      expect(dry.body.data).toMatchObject({
        dryRun: true,
        total: 8,
        created: 4,
        updated: 0,
        skipped: [{ line: 6, reason: 'Trùng với dòng 2' }],
      });
      expect(dry.body.data.errors).toEqual([
        { line: 7, messages: ['Cột gradeLevel: quá lớn'] },
        { line: 8, messages: ['Đáp án đúng phải là một trong các lựa chọn'] },
        { line: 9, messages: [expect.stringContaining('đúng một chỗ trống')] },
      ]);
      const before = await http
        .get(`${API}/questions?mine=true&topic=Colors`)
        .set(auth(teacherToken))
        .expect(200);
      expect(before.body.data.total).toBe(0);

      const real = await http
        .post(`${API}/questions/import?dryRun=false`)
        .set(auth(teacherToken))
        .send({ csv })
        .expect(200);
      expect(real.body.data.created).toBe(4);
      const again = await http
        .post(`${API}/questions/import?dryRun=false`)
        .set(auth(teacherToken))
        .send({ csv })
        .expect(200);
      expect(again.body.data.created).toBe(0);
      expect(again.body.data.skipped).toHaveLength(5);

      await http
        .post(`${API}/questions/import`)
        .set(auth(teacherToken))
        .send({ csv: 'foo,bar\n1,2' })
        .expect(400);
      await http
        .post(`${API}/questions/import`)
        .set(auth(kids[1].token))
        .send({ csv })
        .expect(403);
      const template = await http
        .get(`${API}/questions/import/template`)
        .set(auth(teacherToken))
        .expect(200);
      expect(template.headers['content-type']).toContain('text/csv');
    });

    it('accepts the bundled starter content without errors', async () => {
      const { readFile } = await import('node:fs/promises');
      const starter = await readFile(
        new URL(
          '../src/database/seed/content/starter-bank.csv',
          import.meta.url,
        ),
        'utf8',
      );
      const res = await http
        .post(`${API}/questions/import?dryRun=true`)
        .set(auth(adminToken))
        .send({ csv: starter })
        .expect(200);
      expect(res.body.data.errors).toEqual([]);
      expect(res.body.data.created).toBe(48);
    });

    it('lets an admin reorder the stations of a grade', async () => {
      const map = await http
        .get(`${API}/quizzes/map-order?gradeLevel=1`)
        .set(auth(adminToken))
        .expect(200);
      const ids = map.body.data.map((q: { id: string }) => q.id);
      expect(ids.length).toBeGreaterThan(1);
      const reversed = [...ids].reverse();
      await http
        .put(`${API}/quizzes/map-order`)
        .set(auth(adminToken))
        .send({ gradeLevel: 1, quizIds: reversed })
        .expect(200);
      const studentMap = await http
        .get(`${API}/progress/map`)
        .set(auth(kids[1].token))
        .expect(200);
      expect(
        studentMap.body.data.stations.map((s: { id: string }) => s.id),
      ).toEqual(reversed);
      await http
        .put(`${API}/quizzes/map-order`)
        .set(auth(adminToken))
        .send({ gradeLevel: 1, quizIds: [quizId] }) // a teacher quiz
        .expect(400);
      await http
        .get(`${API}/quizzes/map-order?gradeLevel=1`)
        .set(auth(teacherToken))
        .expect(403);
    });
  });
});
