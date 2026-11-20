/**
 * Due dates are picked and shown in Vietnam time (UTC+7, no DST) whatever
 * the browser's time zone, matching the backend (common/utils/vn-time.ts).
 */
const VN_OFFSET_MS = 7 * 3600_000
const pad = (n: number) => String(n).padStart(2, '0')

/** Default homework deadline: 20:00 Vietnam time. */
export const DEFAULT_DUE_TIME = '20:00'

/** { date: "2026-11-23", time: "20:00" } as seen on a clock in Vietnam. */
export function toVnInputs(value: string | Date): { date: string; time: string } {
  const local = new Date(new Date(value).getTime() + VN_OFFSET_MS)
  return {
    date: `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`,
    time: `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`,
  }
}

/** Vietnam date + time inputs -> the UTC instant (null when incomplete). */
export function fromVnInputs(date: string, time: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const t = /^(\d{2}):(\d{2})$/.exec(time)
  if (!d || !t) return null
  return new Date(Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2]) - VN_OFFSET_MS)
}

/** `days` days after today (Vietnam calendar) at 20:00 Vietnam time. */
export function defaultDue(days = 7, now = new Date()): { date: string; time: string } {
  const today = toVnInputs(now).date
  const [y, m, d] = today.split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1, d + days))
  return {
    date: `${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-${pad(target.getUTCDate())}`,
    time: DEFAULT_DUE_TIME,
  }
}

/** "2026-11-16": the Vietnam calendar day, for once-a-day reminders. */
export const vnDayKey = (now = new Date()) => toVnInputs(now).date

/** "Thứ Hai, 23/11 lúc 20:00" */
export function formatDue(value: string | Date): string {
  const local = new Date(new Date(value).getTime() + VN_OFFSET_MS)
  const weekdays = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
  return `${weekdays[local.getUTCDay()]}, ${pad(local.getUTCDate())}/${pad(local.getUTCMonth() + 1)} lúc ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`
}

/** "Còn 5 giờ", "Còn 2 ngày", "Quá hạn 1 ngày". */
export function countdown(due: string | Date, now = new Date()): string {
  const diff = new Date(due).getTime() - now.getTime()
  const abs = Math.abs(diff)
  const minutes = Math.floor(abs / 60_000)
  const hours = Math.floor(abs / 3600_000)
  const days = Math.floor(abs / 86_400_000)
  const span =
    hours < 1 ? `${Math.max(minutes, 1)} phút` : hours < 48 ? `${hours} giờ` : `${days} ngày`
  return diff >= 0 ? `Còn ${span}` : `Quá hạn ${span}`
}
