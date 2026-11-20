/**
 * Phase 2 data migration. Safe to run more than once.
 *
 *   npm run migrate:phase2
 *
 * - Removes the dropped reward fields (stars, diamonds, inventory, avatar,
 *   quiz rewardConfig, attempt starsEarned/diamondsEarned).
 * - Recomputes passed / xpEarned / leveledUp / levelAfter on every attempt,
 *   replaying each student's attempts in time order with the phase 2 rules,
 *   then stores each student's level and XP.
 *
 * Reads MONGODB_URI from the environment or from be/.env.
 */
import { connect, disconnect } from './lib.mjs';

const PASS_SCORE = 60; // keep in sync with src/modules/progress/progression/progression.rules.ts

const db = await connect();
const users = db.collection('users');
const quizzes = db.collection('quizzes');
const attempts = db.collection('student_progress');

const u = await users.updateMany(
  {},
  {
    $unset: {
      avatarUrl: '',
      'studentProfile.stars': '',
      'studentProfile.diamonds': '',
      'studentProfile.inventory': '',
    },
  },
);
const q = await quizzes.updateMany({}, { $unset: { rewardConfig: '' } });
const a = await attempts.updateMany(
  {},
  { $unset: { starsEarned: '', diamondsEarned: '' } },
);
console.log(
  `Removed reward fields: ${u.modifiedCount} users, ${q.modifiedCount} quizzes, ${a.modifiedCount} attempts`,
);

const students = await users.find({ role: 'student' }).toArray();
for (const student of students) {
  const best = new Map(); // quizId -> best score so far
  const passedQuizzes = new Set();
  let xp = 0;
  const ops = [];

  const list = await attempts
    .find({ studentId: student._id })
    .sort({ completedAt: 1 })
    .toArray();
  for (const attempt of list) {
    const key = attempt.quizId.toString();
    const previous = best.get(key) ?? 0;
    const passed = attempt.score >= PASS_SCORE;
    const leveledUp = passed && !passedQuizzes.has(key);
    const xpEarned = Math.max(0, attempt.score - previous);
    best.set(key, Math.max(previous, attempt.score));
    if (passed) passedQuizzes.add(key);
    xp += xpEarned;
    ops.push({
      updateOne: {
        filter: { _id: attempt._id },
        update: {
          $set: {
            passed,
            xpEarned,
            leveledUp,
            levelAfter: passedQuizzes.size + 1,
          },
        },
      },
    });
  }
  if (ops.length) await attempts.bulkWrite(ops);
  await users.updateOne(
    { _id: student._id },
    {
      $set: {
        'studentProfile.level': passedQuizzes.size + 1,
        'studentProfile.xp': xp,
      },
    },
  );
  console.log(
    `${student.username}: ${list.length} attempts -> level ${passedQuizzes.size + 1}, ${xp} XP`,
  );
}

await disconnect();
console.log('Phase 2 migration done.');
