import { Input } from '@/shared/components'
import { cn } from '@/shared/lib/cn'
import type { RangeChoice, RangePreset } from '../lib/range'

const PRESETS: { value: RangePreset; label: string }[] = [
  { value: '7d', label: '7 ngày' },
  { value: '30d', label: '30 ngày' },
  { value: 'term', label: 'Học kỳ' },
  { value: 'custom', label: 'Tùy chọn' },
]

/** Period picker shared by every analytics screen. */
export function RangeFilter({
  value,
  onChange,
}: {
  value: RangeChoice
  onChange: (next: RangeChoice) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Khoảng thời gian">
      {PRESETS.map((p) => (
        <button
          key={p.value}
          type="button"
          aria-pressed={value.preset === p.value}
          onClick={() => onChange({ ...value, preset: p.value })}
          className={cn(
            'min-h-11 rounded-xl border-2 px-3 py-1.5 text-sm font-bold transition-colors',
            value.preset === p.value
              ? 'border-brand bg-brand-soft text-brand-dark'
              : 'border-line bg-surface text-ink-soft hover:border-brand',
          )}
        >
          {p.label}
        </button>
      ))}
      {value.preset === 'custom' ? (
        <span className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            aria-label="Từ ngày"
            value={value.fromDay}
            max={value.toDay}
            onChange={(e) => onChange({ ...value, fromDay: e.target.value })}
            className="w-auto! py-1.5"
          />
          <span className="font-bold text-ink-soft">→</span>
          <Input
            type="date"
            aria-label="Đến ngày"
            value={value.toDay}
            min={value.fromDay}
            onChange={(e) => onChange({ ...value, toDay: e.target.value })}
            className="w-auto! py-1.5"
          />
        </span>
      ) : null}
    </div>
  )
}
