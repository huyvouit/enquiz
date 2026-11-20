/**
 * Phase 3 data migration. Safe to run more than once.
 *
 *   npm run migrate:phase3              # apply
 *   npm run migrate:phase3 -- --dry-run # report only
 *
 * 1. users: status "active" for existing accounts (new teachers start "pending").
 * 2. quiz_sessions: the unique key becomes (student, quiz, assignment) so the
 *    same quiz can be open on the map and as homework.
 * 3. quizzes: system quizzes get a mapOrder (current order kept); published
 *    teacher quizzes, which leave the quest map, are listed for follow-up.
 * 4. questions: tags = [] and trimmed topics.
 * 5. student_progress: index for homework lookups.
 */
import { connect, disconnect, dryRun } from './lib.mjs';

const db = await connect();
const users = db.collection('users');
const sessions = db.collection('quiz_sessions');
const quizzes = db.collection('quizzes');
const questions = db.collection('questions');
const attempts = db.collection('student_progress');

// 1. Account status
const noStatus = { status: { $exists: false } };
console.log(`1. users without status: ${await users.countDocuments(noStatus)}`);
if (!dryRun) await users.updateMany(noStatus, { $set: { status: 'active' } });

// 2. Session key
const sessionIndexes = await sessions.indexes().catch(() => []);
const oldIndex = sessionIndexes.find(
  (i) => JSON.stringify(i.key) === JSON.stringify({ studentId: 1, quizId: 1 }),
);
const openSessions = await sessions.countDocuments({
  assignmentId: { $exists: false },
});
console.log(
  `2. quiz_sessions: old unique index ${oldIndex ? `"${oldIndex.name}" will be dropped` : 'already gone'}; ${openSessions} open sessions get assignmentId=null`,
);
if (!dryRun) {
  if (oldIndex) await sessions.dropIndex(oldIndex.name);
  await sessions.updateMany(
    { assignmentId: { $exists: false } },
    { $set: { assignmentId: null } },
  );
  await sessions.createIndex(
    { studentId: 1, quizId: 1, assignmentId: 1 },
    { unique: true },
  );
}

// 3. Quest map order + teacher quizzes leaving the map
const system = await quizzes
  .find({ createdBy: null })
  .sort({ gradeLevel: 1, createdAt: 1, _id: 1 })
  .toArray();
const byGrade = new Map();
for (const q of system)
  byGrade.set(q.gradeLevel, [...(byGrade.get(q.gradeLevel) ?? []), q]);
let ordered = 0;
for (const [grade, list] of byGrade) {
  let next = Math.max(0, ...list.map((q) => q.mapOrder ?? 0));
  for (const q of list) {
    if (q.mapOrder != null) continue;
    next++;
    ordered++;
    if (!dryRun)
      await quizzes.updateOne({ _id: q._id }, { $set: { mapOrder: next } });
  }
  console.log(`3. grade ${grade}: ${list.length} system stations`);
}
console.log(`   mapOrder assigned to ${ordered} system quizzes`);
const leaving = await quizzes
  .find(
    { createdBy: { $ne: null }, status: 'published' },
    { projection: { title: 1, gradeLevel: 1, createdBy: 1 } },
  )
  .toArray();
if (leaving.length > 0) {
  const authors = new Map(
    (
      await users
        .find({ _id: { $in: leaving.map((q) => q.createdBy) } })
        .toArray()
    ).map((u) => [u._id.toString(), u.fullName]),
  );
  console.log(
    `   ${leaving.length} teacher quizzes are no longer on the quest map (give them to classes as homework):`,
  );
  for (const q of leaving) {
    console.log(
      `   - [grade ${q.gradeLevel}] ${q.title} (${authors.get(q.createdBy.toString()) ?? '?'})`,
    );
  }
}

// 4. Questions
const noTags = { tags: { $exists: false } };
console.log(
  `4. questions without tags: ${await questions.countDocuments(noTags)}`,
);
let trimmed = 0;
for (const q of await questions
  .find({}, { projection: { topic: 1 } })
  .toArray()) {
  const clean = String(q.topic ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (clean !== q.topic) {
    trimmed++;
    if (!dryRun)
      await questions.updateOne({ _id: q._id }, { $set: { topic: clean } });
  }
}
console.log(`   topics trimmed: ${trimmed}`);
if (!dryRun) await questions.updateMany(noTags, { $set: { tags: [] } });
const topics = await questions
  .aggregate([
    { $group: { _id: '$topic', n: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ])
  .toArray();
console.log(
  `   topics in the bank (check for near-duplicates such as Animal/Animals):`,
);
console.log(`   ${topics.map((t) => `${t._id} (${t.n})`).join(', ')}`);

// 5. Homework index
console.log('5. student_progress index {assignmentId, studentId, completedAt}');
if (!dryRun) {
  await attempts.createIndex({ assignmentId: 1, studentId: 1, completedAt: 1 });
}

console.log(dryRun ? '\nDry run finished.' : '\nPhase 3 migration done.');
await disconnect();
