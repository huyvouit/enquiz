/**
 * Live quiz scoring (plan 5, L6). Pure functions, unit-tested.
 * Times are measured by the server: when it started the answering phase and
 * when it received the answer, never the device clock.
 */

/** Points for an instant correct answer; a correct answer at the buzzer gets half. */
export const MAX_POINTS = 1000;

/** Points for a correct answer given `elapsedMs` into a `limitMs` window. */
export function answerPoints(elapsedMs: number, limitMs: number): number {
  if (limitMs <= 0) return 0;
  const t = Math.min(Math.max(elapsedMs, 0), limitMs);
  return Math.round(MAX_POINTS * (1 - 0.5 * (t / limitMs)));
}

export interface ScoreRow {
  playerId: string;
  nickname: string;
  score: number;
  correctCount: number;
}

export interface Standing extends ScoreRow {
  /** Competition ranking: equal scores share a rank (1, 1, 3). */
  rank: number;
}

const byName = new Intl.Collator('vi', { sensitivity: 'base' });

/** Highest score first; ties share the rank and are listed by name. */
export function rankPlayers(rows: ScoreRow[]): Standing[] {
  const sorted = [...rows].sort(
    (a, b) => b.score - a.score || byName.compare(a.nickname, b.nickname),
  );
  let rank = 0;
  return sorted.map((row, i) => {
    if (i === 0 || row.score !== sorted[i - 1].score) rank = i + 1;
    return { ...row, rank };
  });
}
