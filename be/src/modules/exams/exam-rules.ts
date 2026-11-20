/**
 * Pure exam rules (plan 4.2): answer cleaning, grading of a whole sheet,
 * timing. No database access, unit-tested directly.
 */
import { Types } from 'mongoose';
import {
  computeScore,
  type GradableQuestion,
  gradeAnswer,
} from '../progress/grading/graders.js';
import type { AnswerDetail } from '../progress/schemas/student-progress.schema.js';

/** Longest text kept for one typed answer or one piece. */
const MAX_TEXT = 300;
/** Most pieces / pairs kept for one answer. */
const MAX_ITEMS = 30;

export interface RawAnswer {
  questionId: string;
  answer?: unknown;
}

export interface CleanAnswer {
  questionId: Types.ObjectId;
  answer: unknown;
}

const isText = (v: unknown): v is string =>
  typeof v === 'string' && v.length <= MAX_TEXT;

const isPair = (v: unknown): boolean =>
  typeof v === 'object' &&
  v !== null &&
  isText((v as { left?: unknown }).left) &&
  isText((v as { right?: unknown }).right);

/**
 * A storable answer, or null (not answered / unexpected shape). Pairs are
 * reduced to {left, right} so nothing else is ever stored.
 */
export function cleanAnswer(value: unknown): unknown {
  if (typeof value === 'string') {
    return isText(value) && value.trim() !== '' ? value : null;
  }
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_ITEMS) {
    return null;
  }
  if (value.every(isText)) return value;
  if (value.every(isPair)) {
    return (value as { left: string; right: string }[]).map((p) => ({
      left: p.left,
      right: p.right,
    }));
  }
  return null;
}

/**
 * Keeps one answer per question of the exam (the last one sent), drops
 * unknown questions and empty answers.
 */
export function cleanAnswers(
  raw: RawAnswer[],
  questionIds: Types.ObjectId[],
): CleanAnswer[] {
  const allowed = new Set(questionIds.map(String));
  const byId = new Map<string, unknown>();
  for (const r of raw) {
    if (!allowed.has(r.questionId)) continue;
    const answer = cleanAnswer(r.answer);
    if (answer === null) byId.delete(r.questionId);
    else byId.set(r.questionId, answer);
  }
  return questionIds
    .filter((id) => byId.has(id.toString()))
    .map((id) => ({ questionId: id, answer: byId.get(id.toString()) }));
}

/** Flags limited to questions of the exam, without duplicates. */
export function cleanFlags(
  flagged: string[] | undefined,
  questionIds: Types.ObjectId[],
): Types.ObjectId[] {
  const wanted = new Set(flagged ?? []);
  return questionIds.filter((id) => wanted.has(id.toString()));
}

export interface GradedSheet {
  details: AnswerDetail[];
  correctCount: number;
  score: number;
}

/**
 * Grades the sheet once (plan E3). `questions` are the exam's questions
 * still in the bank, in exam order; deleted ones do not count. Unanswered
 * questions are wrong.
 */
export function gradeSheet(
  questions: (GradableQuestion & { _id: Types.ObjectId })[],
  answers: CleanAnswer[],
): GradedSheet {
  const given = new Map(
    answers.map((a) => [a.questionId.toString(), a.answer]),
  );
  const details = questions.map((q) => {
    const answer = given.get(q._id.toString()) ?? null;
    return {
      questionId: q._id,
      studentAnswer: answer,
      isCorrect: answer !== null && gradeAnswer(q, answer),
    };
  });
  const correctCount = details.filter((d) => d.isCorrect).length;
  return {
    details,
    correctCount,
    score: computeScore(correctCount, questions.length),
  };
}

/**
 * When the attempt counts as handed in. A session closed by the server
 * after the deadline counts at the deadline, so a late check by the server
 * never turns an on-time exam into a late homework (plan D7).
 */
export function completedAtOf(
  session: { deadlineAt: Date },
  now: Date,
  timedOut: boolean,
): Date {
  return timedOut && now.getTime() > session.deadlineAt.getTime()
    ? session.deadlineAt
    : now;
}

/** Seconds spent, at most the time allowed. */
export function examDurationSec(
  session: { startedAt: Date; timeLimitSec: number },
  completedAt: Date,
): number {
  const spent = Math.round(
    (completedAt.getTime() - session.startedAt.getTime()) / 1000,
  );
  return Math.max(0, Math.min(spent, session.timeLimitSec));
}
