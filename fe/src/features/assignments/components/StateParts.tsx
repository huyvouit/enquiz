import { Badge, Field, Input } from '@/shared/components'
import { STATE_META, STATE_ORDER } from '../lib/states'
import type { SubmissionCounts, SubmissionState } from '../types'

export function StateChip({ state }: { state: SubmissionState }) {
  const meta = STATE_META[state]
  return (
    <Badge tone={meta.tone}>
      <span aria-hidden>{meta.icon}</span> {meta.label}
    </Badge>
  )
}

const COUNT_KEY: Record<SubmissionState, keyof SubmissionCounts> = {
  on_time: 'onTime',
  late: 'late',
  pending: 'pending',
  missing: 'missing',
}

/** Stacked bar ✅ 🕒 ⏳ ❌ with the counts below it. */
export function CountsBar({ counts }: { counts: SubmissionCounts }) {
  const total = Math.max(counts.assigned, 1)
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100"
        role="img"
        aria-label={STATE_ORDER.map((s) => `${STATE_META[s].label}: ${counts[COUNT_KEY[s]]}`).join(', ')}
      >
        {STATE_ORDER.map((s) =>
          counts[COUNT_KEY[s]] > 0 ? (
            <span
              key={s}
              className={STATE_META[s].bar}
              style={{ width: `${(counts[COUNT_KEY[s]] / total) * 100}%` }}
            />
          ) : null,
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs font-bold text-ink-soft">
        {STATE_ORDER.map((s) => (
          <span key={s} title={STATE_META[s].label}>
            {STATE_META[s].icon} {counts[COUNT_KEY[s]]}
          </span>
        ))}
        <span>/ {counts.assigned} em</span>
      </div>
    </div>
  )
}

/** Date + time inputs, read as Vietnam time by the caller (see lib/vn-time). */
export function DueDateInput({
  date,
  time,
  onChange,
  error,
}: {
  date: string
  time: string
  onChange: (value: { date: string; time: string }) => void
  error?: string | null
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-3">
        <Field label="Hạn nộp (ngày)" className="min-w-40 flex-1">
          <Input type="date" value={date} onChange={(e) => onChange({ date: e.target.value, time })} />
        </Field>
        <Field label="Giờ (giờ Việt Nam)" className="w-36">
          <Input type="time" value={time} onChange={(e) => onChange({ date, time: e.target.value })} />
        </Field>
      </div>
      {error ? <span className="text-sm font-bold text-coral">{error}</span> : null}
    </div>
  )
}
