import type { DateRange } from '../types'

/** Vietnam is UTC+7 all year; reports pick calendar days in Vietnam time. */
const VN_OFFSET_MS = 7 * 3600_000
const DAY_MS = 86_400_000

export type RangePreset = '7d' | '30d' | 'term' | 'custom'

export interface RangeChoice {
  preset: RangePreset
  /** yyyy-mm-dd (Vietnam calendar days), used by "Tùy chọn". */
  fromDay: string
  toDay: string
}

/** Calendar fields of an instant as seen in Vietnam. */
function vnParts(date: Date) {
  const local = new Date(date.getTime() + VN_OFFSET_MS)
  return { y: local.getUTCFullYear(), m: local.getUTCMonth(), d: local.getUTCDate() }
}

/** UTC instant of 00:00 Vietnam time on y-m-d (month 0-based). */
function vnMidnight(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d) - VN_OFFSET_MS)
}

/** "2026-11-16" in Vietnam time. */
export function vnDayKey(date: Date): string {
  const { y, m, d } = vnParts(date)
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function parseDay(day: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!match) return null
  return vnMidnight(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

/**
 * Start of the current school term: the latest of 1 September and 1 January
 * that is not in the future (Vietnamese school year: term 1 from September,
 * term 2 from January — a simple rule, close enough for reports).
 */
export function termStart(now = new Date()): Date {
  const { y, m } = vnParts(now)
  return m >= 8 ? vnMidnight(y, 8, 1) : vnMidnight(y, 0, 1)
}

export function defaultRangeChoice(now = new Date()): RangeChoice {
  return {
    preset: '30d',
    fromDay: vnDayKey(new Date(now.getTime() - 29 * DAY_MS)),
    toDay: vnDayKey(now),
  }
}

/** The from/to sent to the API (ISO). `now` is rounded to the minute so query keys stay stable. */
export function resolveRangeChoice(choice: RangeChoice, now = new Date()): DateRange {
  const end = new Date(Math.ceil(now.getTime() / 60_000) * 60_000)
  const { y, m, d } = vnParts(now)
  const today = vnMidnight(y, m, d)
  switch (choice.preset) {
    case '7d':
      return { from: new Date(today.getTime() - 6 * DAY_MS).toISOString(), to: end.toISOString() }
    case 'term':
      return { from: termStart(now).toISOString(), to: end.toISOString() }
    case 'custom': {
      const from = parseDay(choice.fromDay) ?? new Date(today.getTime() - 29 * DAY_MS)
      const toStart = parseDay(choice.toDay) ?? today
      // Include the whole last day.
      const to = new Date(Math.min(toStart.getTime() + DAY_MS - 1, end.getTime()))
      return { from: from.toISOString(), to: (to > from ? to : end).toISOString() }
    }
    default:
      return { from: new Date(today.getTime() - 29 * DAY_MS).toISOString(), to: end.toISOString() }
  }
}

const dayFormat = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Asia/Ho_Chi_Minh',
})

export const formatVnDay = (iso: string) => dayFormat.format(new Date(iso))

export const formatRange = (range: DateRange) => `${formatVnDay(range.from)} – ${formatVnDay(range.to)}`
