import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { App } from 'supertest/types.js';

// Must be set before AppModule is imported (ConfigModule validates on import).
process.env.MONGODB_URI = 'memory';
process.env.JWT_SECRET = 'e2e-test-secret-at-least-16-chars';
process.env.SEED_DEMO_DATA = 'true';
process.env.AUTH_RATE_LIMIT = '1000';
process.env.AUTH_IP_RATE_LIMIT = '1000';
process.env.UPLOAD_DIR = `${tmpdir()}/enquiz-e2e-live-${process.pid}`;
process.env.TTS_DRIVER = 'fake';
process.env.LIVE_CORS_ORIGINS = 'http://localhost:5173,https://enquiz.web.app';

const { AppModule } = await import('../src/app.module.js');
const { setupApp } = await import('../src/common/setup-app.js');

const API = '/api/v1';

describe('EnQuiz API — phase 5.0: live socket foundation (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;
  let base: string;
  const sockets: Socket[] = [];
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const login = async (username: string, password: string) =>
    (
      await http
        .post(`${API}/auth/login`)
        .send({ username, password })
        .expect(200)
    ).body.data.accessToken as string;

  /** Opens /live and resolves on connect, or rejects with the refusal code. */
  function connect(token?: unknown): Promise<Socket> {
    const socket = io(`${base}/live`, {
      auth: token === undefined ? {} : { token },
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });
    sockets.push(socket);
    return new Promise((resolve, reject) => {
      socket.once('connect', () => resolve(socket));
      socket.once('connect_error', (err) => reject(err));
    });
  }
  const whoami = (socket: Socket) =>
    socket.timeout(5_000).emitWithAck('session:whoami') as Promise<{
      user: { userId: string; role: string } | null;
      clientIp: string;
      serverNow: string;
    }>;

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
    const { port } = server.address();
    base = `http://127.0.0.1:${port}`;
    http = request(app.getHttpServer());
  }, 120_000);

  afterEach(() => {
    for (const s of sockets.splice(0)) s.disconnect();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('accepts an anonymous socket (guests, plan 5.3)', async () => {
    const socket = await connect();
    const me = await whoami(socket);
    expect(me.user).toBeNull();
    expect(me.clientIp).toMatch(/127\.0\.0\.1|::1/);
    expect(Math.abs(Date.parse(me.serverNow) - Date.now())).toBeLessThan(5_000);
  });

  it('identifies a logged-in student from the handshake token (L9)', async () => {
    const token = await login('student', 'student123');
    const me = await whoami(await connect(token));
    expect(me.user).toMatchObject({ role: 'student' });
    expect(me.user?.userId).toMatch(/^[0-9a-f]{24}$/);
  });

  it('refuses a bad or forged token', async () => {
    await expect(connect('not-a-jwt')).rejects.toThrow('unauthorized');
    await expect(connect(12345)).rejects.toThrow('unauthorized');
    const forged =
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQiLCJyb2xlIjoiYWRtaW4ifQ.c2lnbmF0dXJl';
    await expect(connect(forged)).rejects.toThrow('unauthorized');
  });

  it('refuses a teacher waiting for approval', async () => {
    const res = await http
      .post(`${API}/auth/register`)
      .send({
        username: 'cohoa',
        password: 'secret123',
        fullName: 'Cô Hoà',
        role: 'teacher',
      })
      .expect(201);
    await expect(connect(res.body.data.accessToken)).rejects.toThrow('pending');
  });

  it('refuses an account an admin has disabled', async () => {
    const res = await http
      .post(`${API}/auth/register`)
      .send({
        username: 'beti01',
        password: 'secret123',
        fullName: 'Bé Tí',
        role: 'student',
        gradeLevel: 1,
      })
      .expect(201);
    const token = res.body.data.accessToken as string;
    await whoami(await connect(token));

    const admin = await login('admin', 'admin123');
    await http
      .patch(`${API}/admin/users/${res.body.data.user.id}/status`)
      .set(auth(admin))
      .send({ status: 'disabled' })
      .expect(200);
    await expect(connect(token)).rejects.toThrow('unauthorized');
  });

  it('allows only the configured origins for the polling handshake (D19)', async () => {
    const path = '/socket.io/?EIO=4&transport=polling';
    const ok = await request(base)
      .get(path)
      .set('Origin', 'https://enquiz.web.app')
      .expect(200);
    expect(ok.headers['access-control-allow-origin']).toBe(
      'https://enquiz.web.app',
    );
    const other = await request(base)
      .get(path)
      .set('Origin', 'https://evil.example');
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });
});
