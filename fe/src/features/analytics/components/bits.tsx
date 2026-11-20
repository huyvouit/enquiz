import { useState, type ReactNode } from 'react'
import { errorMessage } from '@/shared/api/http'
import { Badge, Button, Card } from '@/shared/components'
import { BAND_STYLE, rateBand, STATE_ICON, STATE_LABEL } from '../lib/labels'
import type { ExportFormat, SubmissionState } from '../types'

export function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: string
  label: string
  value: ReactNode
  hint?: string
}) {
  return (
    <Card className="p-4">
      <p className="text-sm font-bold text-ink-soft">
        <span aria-hidden>{icon}</span> {label}
      </p>
      <p className="mt-1 font-display text-3xl font-extrabold text-brand">{value}</p>
      {hint ? <p className="text-xs text-ink-soft">{hint}</p> : null}
    </Card>
  )
}

const STATE_TONE: Record<SubmissionState, 'grass' | 'sunny' | 'neutral' | 'coral'> = {
  on_time: 'grass',
  late: 'sunny',
  pending: 'neutral',
  missing: 'coral',
}

export function StateChip({ state }: { state: SubmissionState }) {
  return (
    <Badge tone={STATE_TONE[state]}>
      <span aria-hidden>{STATE_ICON[state]}</span> {STATE_LABEL[state]}
    </Badge>
  )
}

/** "62%" on a colored band with an icon (never color alone). */
export function RatePill({ rate, className = '' }: { rate: number | null; className?: string }) {
  const style = BAND_STYLE[rateBand(rate)]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-sm font-extrabold ${style.cell} ${style.text} ${className}`}
    >
      <span aria-hidden className="text-[10px]">
        {style.icon}
      </span>
      {rate === null ? '–' : `${rate}%`}
    </span>
  )
}

/** Horizontal bar 0–100 with an optional class-average marker. */
export function RateBar({ rate, marker }: { rate: number; marker?: number | null }) {
  const style = BAND_STYLE[rateBand(rate)]
  return (
    <div className="relative h-3 w-full rounded-full bg-slate-100" aria-hidden>
      <div
        className={`h-3 rounded-full border ${style.cell}`}
        style={{ width: `${Math.max(2, Math.min(100, rate))}%` }}
      />
      {marker !== null && marker !== undefined ? (
        <div
          className="absolute -top-1 h-5 w-0.5 rounded bg-ink"
          style={{ left: `${Math.min(100, marker)}%` }}
          title={`TB lớp ${marker}%`}
        />
      ) : null}
    </div>
  )
}

/** "Excel" and "PDF" download buttons with a busy state and an error line. */
export function ExportButtons({
  onExport,
  formats = ['xlsx', 'pdf'],
  label = 'Xuất',
}: {
  onExport: (format: ExportFormat) => Promise<void>
  formats?: ExportFormat[]
  label?: string
}) {
  const [busy, setBusy] = useState<ExportFormat | null>(null)
  const [error, setError] = useState<string | null>(null)
  const run = async (format: ExportFormat) => {
    setBusy(format)
    setError(null)
    try {
      await onExport(format)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap gap-2">
        {formats.map((f) => (
          <Button
            key={f}
            variant={f === 'xlsx' ? 'success' : 'secondary'}
            loading={busy === f}
            disabled={busy !== null && busy !== f}
            onClick={() => run(f)}
          >
            {f === 'xlsx' ? '📗' : '📄'} {label} {f === 'xlsx' ? 'Excel' : 'PDF'}
          </Button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="text-sm font-bold text-coral">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 mt-8 flex flex-wrap items-end justify-between gap-3">
      <h2 className="text-2xl font-extrabold">{children}</h2>
      {aside}
    </div>
  )
}
