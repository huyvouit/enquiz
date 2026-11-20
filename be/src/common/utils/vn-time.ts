/**
 * Vietnam time helpers (UTC+7, no daylight saving). Dates are stored in UTC;
 * anything a person reads or picks (due dates, "this week") is Vietnam time.
 */
export const VN_OFFSET_MS = 7 * 3600_000;

/** Calendar fields of `date` as seen on a clock in Vietnam. */
function vnParts(date: Date) {
  const local = new Date(date.getTime() + VN_OFFSET_MS);
  return {
    y: local.getUTCFullYear(),
    m: local.getUTCMonth(),
    d: local.getUTCDate(),
    weekday: local.getUTCDay(), // 0 = Sunday
  };
}

/** UTC instant of `y-m-d hh:mm` Vietnam time (month is 0-based). */
export function vnDate(y: number, m: number, d: number, hh = 0, mm = 0): Date {
  return new Date(Date.UTC(y, m, d, hh, mm) - VN_OFFSET_MS);
}

export function vnStartOfDay(now = new Date()): Date {
  const { y, m, d } = vnParts(now);
  return vnDate(y, m, d);
}

/** Weeks start on Monday. */
export function vnStartOfWeek(now = new Date()): Date {
  const { y, m, d, weekday } = vnParts(now);
  return vnDate(y, m, d - ((weekday + 6) % 7));
}

export function vnStartOfMonth(now = new Date()): Date {
  const { y, m } = vnParts(now);
  return vnDate(y, m, 1);
}

/** "2026-11-16" (Vietnam calendar day) — for file names and report headers. */
export function vnDateKey(date: Date): string {
  const { y, m, d } = vnParts(date);
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** "16/11/2026 20:00" in Vietnam time. */
export function formatVnDateTime(date: Date): string {
  const local = new Date(date.getTime() + VN_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(local.getUTCDate())}/${p(local.getUTCMonth() + 1)}/${local.getUTCFullYear()} ${p(local.getUTCHours())}:${p(local.getUTCMinutes())}`;
}
