/**
 * Live quiz socket check (plan 5.0, D19). Run against a local or deployed API:
 *
 *   node scripts/live-check.mjs --url https://enquiz-api-xxxx.a.run.app
 *   node scripts/live-check.mjs --url http://localhost:3000 --clients 60
 *   node scripts/live-check.mjs --url <cloud-run> --hold 65   # minutes
 *
 * Options:
 *   --url      API origin (no /api/v1). Default http://localhost:3000
 *   --token    JWT to connect as a logged-in user (or env LIVE_TOKEN);
 *              without it the sockets are anonymous.
 *   --origin   Origin header to send (checks LIVE_CORS_ORIGINS for polling).
 *   --clients  Number of sockets to open at once. Default 1.
 *   --hold     Minutes to keep them open, logging drops and reconnects.
 *              Cloud Run closes a request after --timeout (3600 s): with
 *              --hold 65 you should see one reconnect per socket.
 *
 * Prints: who the server thinks we are and our IP (TRUST_PROXY check),
 * connect time and whoami round trip (min / median / p95 / max).
 */
import { io } from 'socket.io-client';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, a, i, all) => {
    if (a.startsWith('--')) pairs.push([a.slice(2), all[i + 1]]);
    return pairs;
  }, []),
);
const url = (args.url ?? 'http://localhost:3000').replace(/\/$/, '');
const token = args.token ?? process.env.LIVE_TOKEN ?? null;
const clients = Number(args.clients ?? 1);
const holdMin = Number(args.hold ?? 0);

const stats = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const at = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return `min ${s[0]} · median ${at(0.5)} · p95 ${at(0.95)} · max ${s.at(-1)} ms`;
};

function open(i) {
  const started = Date.now();
  const socket = io(`${url}/live`, {
    auth: token ? { token } : {},
    transports: ['websocket'],
    extraHeaders: args.origin ? { Origin: args.origin } : undefined,
    reconnectionDelayMax: 5_000,
  });
  return new Promise((resolve, reject) => {
    socket.once('connect_error', (err) =>
      reject(new Error(`client ${i}: ${err.message}`)),
    );
    socket.once('connect', async () => {
      const connectMs = Date.now() - started;
      const t = Date.now();
      const me = await socket.timeout(10_000).emitWithAck('session:whoami');
      resolve({ socket, connectMs, ackMs: Date.now() - t, me });
    });
  });
}

console.log(`Connecting ${clients} socket(s) to ${url}/live ...`);
const results = await Promise.allSettled(
  Array.from({ length: clients }, (_, i) => open(i)),
);
const ok = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
const failed = results.filter((r) => r.status === 'rejected');
for (const f of failed.slice(0, 5)) console.log('FAILED', f.reason.message);

if (ok.length > 0) {
  const { me, socket } = ok[0];
  console.log(
    'server sees:',
    JSON.stringify(me.user),
    '· clientIp',
    me.clientIp,
  );
  console.log('transport:', socket.io.engine.transport.name);
  console.log(
    'clock skew vs server:',
    Date.now() - Date.parse(me.serverNow),
    'ms (includes one-way latency)',
  );
  console.log(`connect: ${stats(ok.map((r) => r.connectMs))}`);
  console.log(`whoami round trip: ${stats(ok.map((r) => r.ackMs))}`);
}
console.log(`connected ${ok.length}/${clients}, failed ${failed.length}`);

if (holdMin > 0 && ok.length > 0) {
  console.log(`Holding for ${holdMin} min ...`);
  const t0 = Date.now();
  const since = () => `${Math.round((Date.now() - t0) / 1000)}s`;
  ok.forEach(({ socket }, i) => {
    socket.on('disconnect', (reason) =>
      console.log(`[${since()}] client ${i} disconnected: ${reason}`),
    );
    socket.io.on('reconnect', (n) =>
      console.log(`[${since()}] client ${i} reconnected after ${n} try`),
    );
  });
  await new Promise((r) => setTimeout(r, holdMin * 60_000));
}
for (const { socket } of ok) socket.disconnect();
process.exit(failed.length > 0 ? 1 : 0);
