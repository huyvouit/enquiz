/**
 * npm run seed:content — loads the curated question bank from
 * src/database/seed/content/*.csv into the configured database (MONGODB_URI)
 * and builds quest-map stations from the `quiz` column.
 *
 * Idempotent: rows are matched by `externalId` (re-runs update them) and
 * stations by (grade, title). A file with any invalid row is not imported.
 */
// Must stay the first import: turns the demo seed off (see cli-env.ts).
import './cli-env.js';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import type { Model, Types } from 'mongoose';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { AppModule } from '../app.module.js';
import { Role } from '../common/enums/role.enum.js';
import type { AuthUser } from '../common/types/auth-user.js';
import {
  QuestionImportService,
  type SavedRow,
} from '../modules/questions/import/question-import.service.js';
import { Quiz, QuizStatus } from '../modules/quizzes/schemas/quiz.schema.js';

const CONTENT_DIR = path.resolve(process.cwd(), 'src/database/seed/content');
const SYSTEM: AuthUser = {
  userId: '000000000000000000000000',
  username: 'seed-content',
  role: Role.ADMIN,
};

/** Most frequent value (ties: first seen). */
function mode(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

async function upsertStations(quizModel: Model<Quiz>, saved: SavedRow[]) {
  const groups = new Map<string, SavedRow[]>();
  for (const row of saved) {
    if (!row.quiz) continue;
    const key = `${row.gradeLevel}\u0000${row.quiz}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  let created = 0;
  for (const rows of groups.values()) {
    const { gradeLevel, quiz: title } = rows[0];
    const fields = {
      topic: mode(rows.map((r) => r.topic)),
      coverEmoji: rows.find((r) => r.quizEmoji)?.quizEmoji || '📘',
      questionIds: rows.map((r) => r.id) as Types.ObjectId[],
      status: QuizStatus.PUBLISHED,
    };
    const existing = await quizModel.findOne({
      createdBy: null,
      gradeLevel,
      title,
    });
    if (existing) {
      existing.set(fields);
      await existing.save();
      continue;
    }
    const last = await quizModel
      .findOne({ createdBy: null, gradeLevel }, { mapOrder: 1 })
      .sort({ mapOrder: -1 })
      .lean();
    await quizModel.create({
      ...fields,
      title,
      gradeLevel,
      createdBy: null,
      mapOrder: (last?.mapOrder ?? 0) + 1,
    });
    created++;
  }
  return { stations: groups.size, created };
}

async function main() {
  if (process.env.MONGODB_URI === 'memory') {
    console.warn(
      'MONGODB_URI=memory: content would be lost on exit. Point it at a real database.',
    );
  }
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const importer = app.get(QuestionImportService);
  const quizModel = app.get<Model<Quiz>>(getModelToken(Quiz.name));

  const files = (await readdir(CONTENT_DIR))
    .filter((f) => f.endsWith('.csv'))
    .sort();
  let failed = false;
  for (const file of files) {
    const csv = await readFile(path.join(CONTENT_DIR, file), 'utf8');
    const check = await importer.import(csv, SYSTEM, true);
    if (check.report.errors.length > 0) {
      failed = true;
      console.error(`✗ ${file}: not imported`);
      for (const e of check.report.errors) {
        console.error(`  line ${e.line}: ${e.messages.join('; ')}`);
      }
      continue;
    }
    const { report, saved } = await importer.import(csv, SYSTEM, false);
    const stations = await upsertStations(quizModel, saved);
    console.log(
      `✓ ${file}: ${report.created} new, ${report.updated} updated, ` +
        `${report.skipped.length} skipped; ${stations.stations} stations (${stations.created} new)`,
    );
    for (const s of report.skipped)
      console.log(`  line ${s.line}: ${s.reason}`);
  }
  await app.close();
  if (failed) process.exitCode = 1;
}

await main();
