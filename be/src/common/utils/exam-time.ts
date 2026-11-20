/** Exam time rules (plan E1, E6). Pure functions, unit-tested. */

/** Shortest and longest exam a teacher can set. */
export const EXAM_MIN_SEC = 60;
export const EXAM_MAX_SEC = 90 * 60;
/** Used when neither the assignment nor the quiz sets a time. */
export const EXAM_DEFAULT_SEC = 15 * 60;
/** Allowance for network delay after the deadline (plan E1). */
export const EXAM_GRACE_MS = 10_000;

export function examDeadline(startedAt: Date, timeLimitSec: number): Date {
  return new Date(startedAt.getTime() + timeLimitSec * 1000);
}

/** True while answers sent now still count: deadline + grace. */
export function isWithinGrace(deadlineAt: Date, now = new Date()): boolean {
  return now.getTime() <= deadlineAt.getTime() + EXAM_GRACE_MS;
}

/** Sessions whose deadline + grace is before this moment are expired. */
export function expiredBefore(now = new Date()): Date {
  return new Date(now.getTime() - EXAM_GRACE_MS);
}
