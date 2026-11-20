import {
  vnStartOfMonth,
  vnStartOfWeek,
} from '../../../common/utils/vn-time.js';

/**
 * Pure progression rules (no I/O) so they can be unit-tested and reused.
 *
 * - A station (quiz) is PASSED with a score >= PASS_SCORE.
 * - Level = 1 + number of distinct stations passed. Passing a station for the
 *   first time is a level-up and unlocks the next station on that grade's map.
 * - XP from an attempt = improvement over the previous best score of that
 *   quiz, so total XP = sum of best scores and replaying cannot farm XP.
 */
export const PASS_SCORE = 60;

export type StationStatus = 'locked' | 'unlocked' | 'passed';

export interface StationProgress {
  bestScore: number | null;
  passed: boolean;
}

export function isPassingScore(score: number): boolean {
  return score >= PASS_SCORE;
}

export function xpGain(previousBest: number | null, score: number): number {
  return Math.max(0, score - (previousBest ?? 0));
}

export function levelFromPassedCount(passedCount: number): number {
  return passedCount + 1;
}

/**
 * Stations are ordered. One is open when it is the first, when it was already
 * passed (so inserting a new quiz never re-locks finished work), or when the
 * station before it was passed.
 */
export function stationStatuses(
  orderedQuizIds: string[],
  progress: Map<string, StationProgress>,
): StationStatus[] {
  return orderedQuizIds.map((id, i) => {
    if (progress.get(id)?.passed) return 'passed';
    if (i === 0) return 'unlocked';
    return progress.get(orderedQuizIds[i - 1])?.passed ? 'unlocked' : 'locked';
  });
}

export type LeaderboardPeriod = 'week' | 'month' | 'all';

/** Vietnam time (UTC+7, no daylight saving). Weeks start on Monday. */
export function periodStart(
  period: LeaderboardPeriod,
  now = new Date(),
): Date | null {
  if (period === 'all') return null;
  return period === 'month' ? vnStartOfMonth(now) : vnStartOfWeek(now);
}
