import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { io } from 'socket.io-client';
import request from 'supertest';
import { App } from 'supertest/types.js';

// Must be set before AppModule is imported (ConfigModule validates on import).
process.env.MONGODB_URI = 'memory';
process.env.JWT_SECRET = 'e2e-test-secret-at-least-16-chars';
process.env.SEED_DEMO_DATA = 'true';
process.env.AUTH_RATE_LIMIT = '1000';
process.env.AUTH_IP_RATE_LIMIT = '1000';
process.env.UPLOAD_DIR = `${tmpdir()}/enquiz-e2e-password-${process.pid}`;
process.env.TTS_DRIVER = 'fake';

const { AppModule } = await import('../src/app.module.js');
const { setupApp } = await import('../src/common/setup-app.js');

const API = '/api/v1';
/** Tokens carry whole seconds: wait so "before the change" is a past second. */
const nextSecond = () => new Promise((r) => setTimeout(r, 1100));

/** Plan D20: change one's own password; older tokens stop working. */
describe('EnQuiz API — change password (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let base: string;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const login = (username: string, password: string) =>
    http.post(`${API}/auth/login`).send({ username, password });
  const token = async (username: string, password: string) =>
    (await login(username, password).expect(200)).body.data
      .accessToken as string;
  const change = (t: string, currentPassword: string, newPassword: string) =>
    http
      .post(`${API}/auth/change-password`)
      .set(auth(t))
      .send({ currentPassword, newPassword });
  const profile = (t: string) => http.get(`${API}/users/profile`).set(auth(t));

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
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  describe('changing my password', () => {
    let deviceA: string;
    let deviceB: string;
    let fresh: string;

    it('returns a fresh token; other devices are logged out', async () => {
      deviceA = await token('teacher', 'teacher123');
      deviceB = await token('teacher', 'teacher123');
      await nextSecond();

      const res = await change(deviceA, 'teacher123', 'co-lan-2026').expect(
        200,
      );
      fresh = res.body.data.accessToken;
      expect(res.body.data.user).toMatchObject({ username: 'teacher' });
      expect(res.body.data.user.password).toBeUndefined();

      await profile(fresh).expect(200);
      const old = await profile(deviceB).expect(401);
      expect(old.body.message).toMatch(/Mật khẩu vừa được đổi/);
      await profile(deviceA).expect(401);
    });

    it('logs in with the new password only', async () => {
      await login('teacher', 'teacher123').expect(401);
      await login('teacher', 'co-lan-2026').expect(200);
    });

    it('a wrong current password is 400 and keeps the session', async () => {
      const res = await change(fresh, 'not-my-password', 'whatever-new').expect(
        400,
      );
      expect(res.body.message).toBe('Mật khẩu hiện tại không đúng');
      await profile(fresh).expect(200);
    });

    it('refuses the same password, the username or a short one', async () => {
      const same = await change(fresh, 'co-lan-2026', 'co-lan-2026').expect(
        400,
      );
      expect(same.body.message).toMatch(/khác mật khẩu hiện tại/);
      const name = await change(fresh, 'co-lan-2026', 'Teacher').expect(400);
      expect(name.body.message).toMatch(/trùng tên đăng nhập/);
      await change(fresh, 'co-lan-2026', '12345').expect(400);
    });

    it('an admin needs at least 12 characters', async () => {
      const admin = await token('admin', 'admin123');
      const res = await change(admin, 'admin123', 'short-pw1').expect(400);
      expect(res.body.message).toMatch(/ít nhất 12/);
      await change(admin, 'admin123', 'a-much-longer-one').expect(200);
    });

    it('a live quiz socket refuses a token from before the change', async () => {
      const connect = (t: string) =>
        new Promise<string>((resolve) => {
          const socket = io(`${base}/live`, {
            auth: { token: t },
            transports: ['websocket'],
            reconnection: false,
            forceNew: true,
          });
          socket.once('connect', () => {
            socket.disconnect();
            resolve('connected');
          });
          socket.once('connect_error', (err) => resolve(err.message));
        });
      expect(await connect(deviceB)).toBe('unauthorized');
      expect(await connect(fresh)).toBe('connected');
    });
  });

  describe('a reset by the teacher', () => {
    it("ends the student's sessions on other devices", async () => {
      const teacher = await token('teacher', 'co-lan-2026');
      const c = await http
        .post(`${API}/classes`)
        .set(auth(teacher))
        .send({ name: 'Lớp đổi mật khẩu', gradeLevel: 1 })
        .expect(201);
      const bulk = await http
        .post(`${API}/classes/${c.body.data.id}/students/bulk`)
        .set(auth(teacher))
        .send({ fullNames: ['Lê Bình'] })
        .expect(201);
      const kid = bulk.body.data.created[0];
      const kidToken = await token(kid.username, kid.password);
      await nextSecond();

      const reset = await http
        .post(
          `${API}/classes/${c.body.data.id}/students/${kid.id}/reset-password`,
        )
        .set(auth(teacher))
        .expect(200);
      await profile(kidToken).expect(401);
      await token(kid.username, reset.body.data.temporaryPassword);
    });
  });

  describe('guessing with a stolen token', () => {
    it('10 attempts a minute per account', async () => {
      const kid = await token('student', 'student123');
      for (let i = 0; i < 10; i++) {
        await change(kid, `guess-${i}`, 'new-password').expect(400);
      }
      await change(kid, 'student123', 'new-password').expect(429);
    });
  });
});
