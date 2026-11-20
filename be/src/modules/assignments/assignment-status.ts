/**
 * Pure rules for homework submissions (plan D7). No database access, so
 * they are unit-tested directly and reused by lists, reports and exports.
 */

/** Reminder window: homework due within this many hours is "due soon". */
export const DUE_SOON_HOURS = 48;
/** Homework given within this many hours shows a "Mới" badge. */
export const NEW_BADGE_HOURS = 72;
/** Furthest due date a teacher can pick. */
export const MAX_DUE_DAYS = 60;

export type SubmissionState =
  /** Submitted at least once on or before the due date. */
  | 'on_time'
  /** Submitted, but only after the due date. */
  | 'late'
  /** Not submitted, still time left. */
  | 'pending'
  /** Not submitted and the due date has passed. */
  | 'missing';

export interface AttemptLite {
  /** student_progress id, so the teacher can open the attempt review. */
  id?: string;
  score: number;
  completedAt: Date;
}

export interface Submission {
  state: SubmissionState;
  /** Score that counts for the homework (null when not submitted). */
  score: number | null;
  /** When the counted submission was first made. */
  submittedAt: Date | null;
  attempts: number;
  /** The attempt whose score counts (best one), for "Xem bài làm". */
  attemptId: string | null;
}

/**
 * Any finished attempt counts as a submission (a pass mark is not required).
 * Score: best on-time attempt; if there is none, best late attempt.
 */
export function submissionOf(
  dueDate: Date,
  attempts: AttemptLite[],
  now = new Date(),
): Submission {
  const due = dueDate.getTime();
  const onTime = attempts.filter((a) => a.completedAt.getTime() <= due);
  const counted = onTime.length > 0 ? onTime : attempts;

  if (counted.length === 0) {
    return {
      state: now.getTime() > due ? 'missing' : 'pending',
      score: null,
      submittedAt: null,
      attempts: 0,
      attemptId: null,
    };
  }
  const firstAt = Math.min(...counted.map((a) => a.completedAt.getTime()));
  const best = counted.reduce((a, b) => (b.score > a.score ? b : a));
  return {
    state: onTime.length > 0 ? 'on_time' : 'late',
    score: best.score,
    submittedAt: new Date(firstAt),
    attempts: attempts.length,
    attemptId: best.id ?? null,
  };
}

export interface SubmissionCounts {
  assigned: number;
  onTime: number;
  late: number;
  pending: number;
  missing: number;
}

export function countStates(submissions: Submission[]): SubmissionCounts {
  const counts: SubmissionCounts = {
    assigned: submissions.length,
    onTime: 0,
    late: 0,
    pending: 0,
    missing: 0,
  };
  for (const s of submissions) {
    if (s.state === 'on_time') counts.onTime++;
    else if (s.state === 'late') counts.late++;
    else if (s.state === 'pending') counts.pending++;
    else counts.missing++;
  }
  return counts;
}

/** Not submitted and due within DUE_SOON_HOURS from now. */
export function isDueSoon(dueDate: Date, now = new Date()): boolean {
  const left = dueDate.getTime() - now.getTime();
  return left > 0 && left <= DUE_SOON_HOURS * 3600_000;
}

export function isNew(createdAt: Date, now = new Date()): boolean {
  return now.getTime() - createdAt.getTime() <= NEW_BADGE_HOURS * 3600_000;
}

/** Average of the counted scores, rounded; null when nobody submitted. */
export function averageScore(submissions: Submission[]): number | null {
  const scores = submissions
    .map((s) => s.score)
    .filter((s): s is number => s !== null);
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}
