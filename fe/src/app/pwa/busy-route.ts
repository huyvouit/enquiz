/**
 * Screens where a reload would cost the child their progress (D25): the exam
 * room, a quiz being played, a live match (player and projector). The update
 * bar and forced updates wait until the user leaves them.
 */
const BUSY = [/^\/exam\//, /^\/play\//, /^\/live\/play$/, /^\/teacher\/live\/[^/]+\/host$/]

export const isBusyRoute = (pathname: string) => BUSY.some((r) => r.test(pathname))

/** -1, 0 or 1, comparing MAJOR.MINOR.PATCH; anything else (e.g. "dev") is null. */
export function compareVersions(a: string, b: string): number | null {
  const parse = (v: string) => (/^\d+\.\d+\.\d+$/.test(v) ? v.split('.').map(Number) : null)
  const x = parse(a)
  const y = parse(b)
  if (!x || !y) return null
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1
  return 0
}
