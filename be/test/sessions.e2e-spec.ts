import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types, type Model } from 'mongoose';
import { createHash } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { io } from 'socket.io-client';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { pw } from './auth-helpers.js';

// Must be set before AppModule is imported (ConfigModule validates on import).
process.env.MONGODB_URI = 'memory';
process.env.JWT_SECRET = 'e2e-test-secret-at-least-16-chars';
process.env.SEED_DEMO_DATA = 'true';
process.env.AUTH_RATE_LIMIT = '1000';
process.env.AUTH_IP_RATE_LIMIT = '1000';
process.env.CORS_ORIGIN = 'https://enquiz-test.web.app';
process.env.LIVE_CORS_ORIGINS =
  'https://enquiz-test.web.app,https://enquiz-test.firebaseapp.com';
process.env.UPLOAD_DIR = `${tmpdir()}/enquiz-e2e-sessions-${process.pid}`;
process.env.TTS_DRIVER = 'fake';

const { AppModule } = await import('../src/app.module.js');
const { setupApp } = await import('../src/common/setup-app.js');
const { AuthSession } =
  await import('../src/modules/users/sessions/auth-session.schema.js');

const API = '/api/v1';
const SITE = 'https://enquiz-test.web.app';
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** The `__session` cookie of a response: its value and attributes. */
function sessionCookie(res: request.Response) {
  const raw = ([] as string[])
    .concat(res.headers['set-cookie'] ?? [])
    .find((c) => c.startsWith('__session='));
  if (!raw) return null;
  const [pair, ...attrs] = raw.split(';').map((p) => p.trim());
  return {
    value: pair.slice('__session='.length),
    attrs: attrs.map((a) => a.toLowerCase()),
    expires: attrs.find((a) => /^expires=/i.test(a))?.slice(8),
  };
}

/** Plan D22: refresh sessions in the `__session` cookie, rotation, revocation. */
describe('EnQuiz API — login sessions (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let base: string;
  let sessions: Model<InstanceType<typeof AuthSession>>;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const login = (username: string, password: string, remember?: boolean) =>
    http
      .post(`${API}/auth/login`)
      .send({
        username,
        password: pw(username, password),
        ...(remember ? { remember } : {}),
      })
      .expect(200);
  /** A browser: the access token and the session cookie from a login. */
  const device = async (username: string, password: string) => {
    const res = await login(username, password);
    return {
      token: res.body.data.accessToken as string,
      cookie: sessionCookie(res)!.value,
    };
  };
  const refresh = (cookie: string | null, origin: string | null = SITE) => {
    const req = http.post(`${API}/auth/refresh`);
    if (cookie !== null) req.set('Cookie', `__session=${cookie}`);
    if (origin !== null) req.set('Origin', origin);
    return req;
  };
  const profile = (t: string) => http.get(`${API}/users/profile`).set(auth(t));
  const connect = (t: string) =>
    new Promise<string>((resolve) => {
      const socket = io(`${base}/live`, {
        auth: { token: t },
        transports: ['websocket'],
        reconnection: false,
        forceNew: true,
        extraHeaders: { Origin: SITE },
      });
      socket.once('connect', () => {
        socket.disconnect();
        resolve('connected');
      });
      socket.once('connect_error', (err) => resolve(err.message));
    });

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
    sessions = app.get(getModelToken(AuthSession.name));
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  describe('login', () => {
    it('sets a browser-session cookie of 12 h without "remember me"', async () => {
      const res = await login('student', 'student123');
      const cookie = sessionCookie(res)!;
      expect(cookie.value).toMatch(/^[\w-]{43}$/);
      expect(cookie.attrs).toEqual(
        expect.arrayContaining([
          'httponly',
          'secure',
          'samesite=strict',
          'path=/api/v1/auth',
        ]),
      );
      expect(cookie.expires).toBeUndefined();
      expect(res.headers['cache-control']).toBe('private, no-store');

      const doc = await sessions
        .findOne({
          userId: new Types.ObjectId(res.body.data.user.id as string),
        })
        .sort({ createdAt: -1 })
        .lean();
      expect(doc!.remember).toBe(false);
      const ttl = doc!.expiresAt.getTime() - Date.now();
      expect(ttl).toBeGreaterThan(12 * HOUR - 60_000);
      expect(ttl).toBeLessThanOrEqual(12 * HOUR);
      // Only a hash is stored.
      expect(JSON.stringify(doc)).not.toContain(cookie.value);
    });

    it('"remember me" sets a 7-day cookie, capped at 14 days', async () => {
      const res = await login('student', 'student123', true);
      const cookie = sessionCookie(res)!;
      const expires = new Date(cookie.expires!).getTime();
      expect(expires - Date.now()).toBeGreaterThan(7 * DAY - 60_000);
      expect(expires - Date.now()).toBeLessThanOrEqual(7 * DAY);
      const doc = await sessions
        .findOne({
          userId: new Types.ObjectId(res.body.data.user.id as string),
          remember: true,
        })
        .lean();
      expect(doc!.maxExpiresAt.getTime() - Date.now()).toBeGreaterThan(
        14 * DAY - 60_000,
      );
    });

    it('sign-up opens a session too', async () => {
      const res = await http
        .post(`${API}/auth/register`)
        .send({
          username: 'phien_moi',
          password: pw('phien_moi', 'phien_moi-123'),
          fullName: 'Phiên Mới',
          role: 'student',
          gradeLevel: 2,
        })
        .expect(201);
      expect(sessionCookie(res)).not.toBeNull();
      await profile(res.body.data.accessToken).expect(200);
    });
  });

  describe('refresh', () => {
    it('swaps the cookie for a new one and returns a new access token', async () => {
      const a = await device('student', 'student123');
      const res = await refresh(a.cookie).expect(200);
      const next = sessionCookie(res)!;
      expect(next.value).not.toBe(a.cookie);
      expect(res.body.data.user).toMatchObject({ username: 'student' });
      await profile(res.body.data.accessToken).expect(200);
      await refresh(next.value).expect(200);
    });

    it('a "remember me" refresh slides the expiry but never past 14 days', async () => {
      const res = await login('student', 'student123', true);
      const sid = await sessions
        .findOne({ remember: true })
        .sort({ createdAt: -1 })
        .lean();
      // As if the login was 13 days ago: only one day is left.
      const cap = new Date(Date.now() + DAY);
      await sessions.updateOne({ _id: sid!._id }, { maxExpiresAt: cap });
      const r = await refresh(sessionCookie(res)!.value).expect(200);
      const expires = new Date(sessionCookie(r)!.expires!).getTime();
      expect(Math.abs(expires - cap.getTime())).toBeLessThan(1_000);
    });

    it('a replayed old cookie ends the whole session', async () => {
      const a = await device('student', 'student123');
      const r1 = await refresh(a.cookie).expect(200);
      const c2 = sessionCookie(r1)!.value;

      // Right after the swap it is a race (two tabs): refused, session kept.
      await refresh(a.cookie).expect(401);
      const r2 = await refresh(c2).expect(200);
      const c3 = sessionCookie(r2)!.value;

      // Later, the replaced cookie can only be a stolen copy.
      await sessions.updateOne(
        { prevHash: createHash('sha256').update(c2).digest('hex') },
        { rotatedAt: new Date(Date.now() - 60_000) },
      );
      const replay = await refresh(c2).expect(401);
      expect(sessionCookie(replay)!.attrs).toContain(
        'expires=thu, 01 jan 1970 00:00:00 gmt',
      );
      await refresh(c3).expect(401);
      await profile(r2.body.data.accessToken).expect(401);
    });

    it('needs the cookie and an Origin of the site', async () => {
      const a = await device('student', 'student123');
      await refresh(null).expect(401);
      await refresh('not-a-real-token').expect(401);
      await refresh(a.cookie, null).expect(403);
      await refresh(a.cookie, 'https://evil.example').expect(403);
      await refresh(a.cookie, 'https://enquiz-test--evil.example').expect(403);
      // Fetch Metadata stands in for a missing Origin on same-origin calls.
      const same = await http
        .post(`${API}/auth/refresh`)
        .set('Cookie', `__session=${a.cookie}`)
        .set('Sec-Fetch-Site', 'same-origin')
        .expect(200);
      // The other Firebase domain and a preview channel are the same site.
      const r = await refresh(
        sessionCookie(same)!.value,
        'https://enquiz-test.firebaseapp.com',
      ).expect(200);
      await refresh(
        sessionCookie(r)!.value,
        'https://enquiz-test--v1-1-0-abc123.web.app',
      ).expect(200);
    });

    it('an expired access token is replaced through refresh', async () => {
      const a = await device('student', 'student123');
      const me = (await profile(a.token).expect(200)).body.data;
      const { sid } = app.get(JwtService).decode<{ sid: string }>(a.token);
      const expired = await app
        .get(JwtService)
        .signAsync(
          { sub: me.id, username: me.username, role: me.role, sid },
          { expiresIn: -10 },
        );
      await profile(expired).expect(401);
      const r = await refresh(a.cookie).expect(200);
      await profile(r.body.data.accessToken).expect(200);
    });

    it('a pending teacher can refresh', async () => {
      const res = await http
        .post(`${API}/auth/register`)
        .send({
          username: 'co_cho_duyet',
          password: pw('co_cho_duyet', 'cho-duyet-123'),
          fullName: 'Cô Chờ Duyệt',
          role: 'teacher',
        })
        .expect(201);
      const r = await refresh(sessionCookie(res)!.value).expect(200);
      expect(r.body.data.user.status).toBe('pending');
    });
  });

  describe('revoking', () => {
    it('logout ends this session at once, other sessions stay', async () => {
      const a = await device('student', 'student123');
      const b = await device('student', 'student123');
      const res = await http
        .post(`${API}/auth/logout`)
        .set('Cookie', `__session=${a.cookie}`)
        .set('Origin', SITE)
        .expect(200);
      expect(sessionCookie(res)!.attrs).toContain(
        'expires=thu, 01 jan 1970 00:00:00 gmt',
      );
      const after = await profile(a.token).expect(401);
      expect(after.body.message).toMatch(/Phiên đăng nhập đã hết hạn/);
      await refresh(a.cookie).expect(401);
      expect(await connect(a.token)).toBe('unauthorized');
      await profile(b.token).expect(200);
      expect(await connect(b.token)).toBe('connected');
    });

    it('logout without a cookie still answers 200', async () => {
      await http.post(`${API}/auth/logout`).set('Origin', SITE).expect(200);
    });

    it('"log out everywhere" ends every session, this one included', async () => {
      const a = await device('teacher', 'teacher123');
      const b = await device('teacher', 'teacher123');
      const res = await http
        .post(`${API}/auth/logout-all`)
        .set(auth(a.token))
        .expect(200);
      expect(res.body.data.sessions).toBeGreaterThanOrEqual(2);
      await profile(a.token).expect(401);
      await profile(b.token).expect(401);
      await refresh(b.cookie).expect(401);
    });

    it('changing my password keeps this session and ends the others', async () => {
      const a = await device('teacher', 'teacher123');
      const b = await device('teacher', 'teacher123');
      const res = await http
        .post(`${API}/auth/change-password`)
        .set(auth(a.token))
        .send({
          currentPassword: pw('teacher', 'teacher123'),
          newPassword: pw('teacher', 'co-lan-2026'),
        })
        .expect(200);
      await profile(res.body.data.accessToken).expect(200);
      await refresh(a.cookie).expect(200);
      await refresh(b.cookie).expect(401);
    });

    it('a reset or a disabled account ends all its sessions', async () => {
      const admin = await device('admin', 'admin123');
      const kid = await device('student', 'student123');
      const kidId = (await profile(kid.token).expect(200)).body.data.id;

      await http
        .post(`${API}/admin/users/${kidId}/reset-password`)
        .set(auth(admin.token))
        .expect(200);
      await refresh(kid.cookie).expect(401);

      const other = await device('phien_moi', 'phien_moi-123');
      const otherId = (await profile(other.token).expect(200)).body.data.id;
      await http
        .patch(`${API}/admin/users/${otherId}/status`)
        .set(auth(admin.token))
        .send({ status: 'disabled' })
        .expect(200);
      await refresh(other.cookie).expect(401);
      expect(
        await sessions.countDocuments({
          userId: new Types.ObjectId(otherId as string),
        }),
      ).toBe(0);
    });

    it('a token from before sessions existed (no sid) is refused', async () => {
      const a = await device('admin', 'admin123');
      const me = (await profile(a.token).expect(200)).body.data;
      const legacy = await app
        .get(JwtService)
        .signAsync({ sub: me.id, username: me.username, role: me.role });
      await profile(legacy).expect(401);
      expect(await connect(legacy)).toBe('unauthorized');
    });
  });
});
