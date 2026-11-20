const dateTime = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export const formatDateTime = (value: string | Date) => dateTime.format(new Date(value))

export function formatDuration(totalSec?: number): string {
  if (totalSec === undefined) return '—'
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return m > 0 ? `${m} phút ${s} giây` : `${s} giây`
}

/** 0–3 stars from a percentage score; drives the result screen celebration. */
export function starsForScore(score: number): 0 | 1 | 2 | 3 {
  if (score >= 90) return 3
  if (score >= 60) return 2
  if (score > 0) return 1
  return 0
}
