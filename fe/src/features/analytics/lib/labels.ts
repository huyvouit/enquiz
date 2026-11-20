import type { GradeCellState, Skill, SubmissionState } from '../types'

export const SKILL_LABEL: Record<Skill, string> = {
  vocabulary: 'Từ vựng',
  grammar: 'Ngữ pháp',
  listening: 'Nghe',
}

export const STATE_LABEL: Record<GradeCellState, string> = {
  on_time: 'Đúng hạn',
  late: 'Nộp muộn',
  pending: 'Chưa nộp',
  missing: 'Quá hạn',
  not_assigned: 'Không giao',
}

export const STATE_ICON: Record<SubmissionState, string> = {
  on_time: '✅',
  late: '🕒',
  pending: '⏳',
  missing: '❌',
}

export type RateBand = 'low' | 'mid' | 'high' | 'none'

/** <50 red, 50–79 yellow, ≥80 green (plan 3.3). */
export function rateBand(rate: number | null): RateBand {
  if (rate === null) return 'none'
  if (rate < 50) return 'low'
  if (rate < 80) return 'mid'
  return 'high'
}

/** Color + icon so the meaning never depends on color alone. */
export const BAND_STYLE: Record<RateBand, { cell: string; text: string; icon: string }> = {
  low: { cell: 'bg-coral-soft border-coral/40', text: 'text-rose-700', icon: '🔻' },
  mid: { cell: 'bg-sunny-soft border-sunny/60', text: 'text-yellow-800', icon: '➖' },
  high: { cell: 'bg-grass-soft border-grass/40', text: 'text-green-700', icon: '✔️' },
  none: { cell: 'bg-slate-50 border-line', text: 'text-ink-soft', icon: '·' },
}

const number = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 })
export const fmt = (value: number | null | undefined, suffix = '') =>
  value === null || value === undefined ? '–' : `${number.format(value)}${suffix}`
