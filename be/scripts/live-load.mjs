/**
 * Live quiz load test (plan 5.1): one room, N students answering together.
 * Creates a throwaway class of N student accounts, so run it against a
 * local or test database, not production data:
 *
 *   node scripts/live-load.mjs --url http://localhost:3000 --players 60
 *
 * Options:
 *   --url        API origin. Default http://localhost:3000
 *   --players    Students in the room (1–60). Default 60.
 *   --questions  Questions to play before ending. Default 3.
 *   --teacher    username:password of an approved teacher. Default teacher:teacher123
 *
 * Prints, per question, how far apart the devices received the question and
 * the reveal (spread = last − first arrival), and the answer round trip.
 */
import { io } from 'socket.io-client';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((pairs, a, i, all) => {
    if (a.startsWith('--')) pairs.push([a.slice(2), all[i + 1]]);
    return pairs;
  }, []),
);
const url = (args.url ?? 'http://localhost:3000').replace(/\/$/, '');
const players = Math.min(60, Number(args.players ?? 60));
const rounds = Number(args.questions ?? 3);
const [tUser, tPass] = (args.teacher ?? 'teacher:teacher123').split(':');

async function call(method, path, token, body) {
  const res = await fetch(`${url}/api/v1${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!json.success) throw new Error(`${method} ${path}: ${json.message}`);
  return json.data;
}
const login = async (username, password) =>
  (await call('POST', '/auth/login', null, { username, password })).accessToken;
const stats = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const at = (p) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return `min ${s[0]} · median ${at(0.5)} · p95 ${at(0.95)} · max ${s.at(-1)} ms`;
};
const connect = (token) =>
  new Promise((resolve, reject) => {
    const socket = io(`${url}/live`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
    });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });

console.log(`Preparing ${players} students...`);
const teacher = await login(tUser, tPass);
const cls = await call('POST', '/classes', teacher, {
  name: `Tải thử ${Date.now() % 100000}`,
  gradeLevel: 1,
});
const bulk = await call('POST', `/classes/${cls.id}/students/bulk`, teacher, {
  fullNames: Array.from({ length: players }, (_, i) => `Học Sinh ${i + 1}`),
});
const tokens = [];
for (let i = 0; i < bulk.created.length; i += 10) {
  tokens.push(
    ...(await Promise.all(
      bulk.created.slice(i, i + 10).map((k) => login(k.username, k.password)),
    )),
  );
}
const quizzes = (await call('GET', '/quizzes?gradeLevel=1', teacher)).items;
let match;
for (const q of quizzes) {
  try {
    match = await call('POST', '/live/matches', teacher, {
      quizId: q.id,
      classId: cls.id,
      questionTimeSec: 20,
    });
    break;
  } catch {
    // no multiple-choice question in this quiz: try the next one
  }
}
console.log(`Room ${match.pin}: ${match.playableCount} questions`);

const host = await connect(teacher);
await host.emitWithAck('host:attach', { matchId: match.matchId });
const kids = await Promise.all(
  tokens.map(async (token) => {
    const socket = await connect(token);
    const kid = { socket, seen: new Map() };
    socket.on('room:state', (v) => {
      const key = `${v.phase}:${v.questionIndex}`;
      if (!kid.seen.has(key)) kid.seen.set(key, { at: Date.now(), view: v });
    });
    const t = Date.now();
    const ack = await socket.emitWithAck('player:join', { pin: match.pin });
    if (!ack.ok) throw new Error(ack.message);
    kid.joinMs = Date.now() - t;
    return kid;
  }),
);
console.log(
  `joined ${kids.length}/${players} · join round trip: ${stats(kids.map((k) => k.joinMs))}`,
);

const waitAll = async (key) => {
  for (let i = 0; i < 400 && !kids.every((k) => k.seen.has(key)); i++) {
    await new Promise((r) => setTimeout(r, 25));
  }
  const times = kids.map((k) => k.seen.get(key)?.at).filter(Boolean);
  return { times, count: times.length };
};
const spread = (times) => Math.max(...times) - Math.min(...times);

/** Sends a host command; returns when it was sent (before the reply). */
const send = async (event) => {
  const sentAt = Date.now();
  const ack = await host.emitWithAck(event);
  if (!ack.ok) throw new Error(`${event}: ${ack.message}`);
  return sentAt;
};

const total = Math.min(rounds, match.playableCount);
for (let q = 0; q < total; q++) {
  const sentAt = await send(q === 0 ? 'host:start' : 'host:next');
  const countdown = await waitAll(`countdown:${q}`);
  const answering = await waitAll(`answering:${q}`);
  const answerMs = await Promise.all(
    kids.map(async (k) => {
      await new Promise((r) => setTimeout(r, Math.random() * 3_000));
      const view = k.seen.get(`answering:${q}`).view;
      const choice = Math.floor(Math.random() * view.question.options.length);
      const t = Date.now();
      const ack = await k.socket.emitWithAck('player:answer', {
        questionIndex: q,
        choice,
      });
      if (!ack.ok) throw new Error(ack.message);
      return Date.now() - t;
    }),
  );
  const reveal = await waitAll(`reveal:${q}`);
  console.log(
    `Q${q + 1}: question to ${countdown.count} devices in ${Math.max(...countdown.times) - sentAt} ms (spread ${spread(countdown.times)} ms)` +
      ` · answering spread ${spread(answering.times)} ms` +
      ` · reveal to ${reveal.count} devices, spread ${spread(reveal.times)} ms`,
  );
  console.log(`    answer round trip: ${stats(answerMs)}`);
  if (q < total - 1) await send('host:next'); // → leaderboard
}
await send('host:end');
const podium = await waitAll(`podium:${total - 1}`);
console.log(`podium on ${podium.count}/${players} devices`);
for (const k of kids) k.socket.disconnect();
host.disconnect();
process.exit(podium.count === players ? 0 : 1);
