import { useState, type KeyboardEvent } from 'react'
import { Button, Input } from '@/shared/components'
import { cn } from '@/shared/lib/cn'

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()

/**
 * A list of short values typed one by one (Enter or "Thêm"), shown as chips
 * with ✕. Duplicates (case-insensitive) are ignored.
 */
export function ChipsInput({
  values,
  onChange,
  max,
  maxLength = 60,
  placeholder,
  ariaLabel,
  tone = 'brand',
}: {
  values: string[]
  onChange: (values: string[]) => void
  max: number
  maxLength?: number
  placeholder?: string
  ariaLabel: string
  tone?: 'brand' | 'grass' | 'sunny'
}) {
  const [draft, setDraft] = useState('')
  const full = values.length >= max

  function add() {
    const v = draft.trim().replace(/\s+/g, ' ')
    if (!v || full) return
    if (!values.some((x) => norm(x) === norm(v))) onChange([...values, v])
    setDraft('')
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault() // never submit the whole form
      add()
    }
  }

  const chip = {
    brand: 'bg-brand-soft text-brand-dark',
    grass: 'bg-grass-soft text-green-800',
    sunny: 'bg-sunny-soft text-yellow-900',
  }[tone]

  return (
    <div className="flex flex-col gap-2">
      {values.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label={ariaLabel}>
          {values.map((v) => (
            <li key={v} className={cn('inline-flex items-center gap-1 rounded-full py-1 pl-3 pr-1 font-bold', chip)}>
              {v}
              <button
                type="button"
                aria-label={`Bỏ ${v}`}
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="flex size-7 items-center justify-center rounded-full hover:bg-white/70"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {!full ? (
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            maxLength={maxLength}
            aria-label={ariaLabel}
          />
          <Button variant="secondary" onClick={add} disabled={!draft.trim()}>
            Thêm
          </Button>
        </div>
      ) : (
        <p className="text-xs text-ink-soft">Đã đủ {max} mục.</p>
      )}
    </div>
  )
}
