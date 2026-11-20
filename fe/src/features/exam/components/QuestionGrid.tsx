import { cn } from '@/shared/lib/cn'

export interface GridItem {
  id: string
  answered: boolean
  flagged: boolean
}

/**
 * One big numbered tile per question: green = answered, white = blank,
 * 🚩 = marked for review; the current one has a thick ring. Tap to jump.
 */
export function QuestionGrid({
  items,
  current,
  onPick,
}: {
  items: GridItem[]
  current: number
  onPick: (index: number) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <ol className="grid grid-cols-5 gap-3 sm:grid-cols-8">
        {items.map((item, i) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onPick(i)}
              aria-current={i === current ? 'step' : undefined}
              aria-label={`Câu ${i + 1}${item.answered ? ', đã làm' : ', chưa làm'}${item.flagged ? ', đã đánh dấu' : ''}`}
              className={cn(
                'relative flex size-14 w-full items-center justify-center rounded-2xl border-4 font-display text-xl font-extrabold',
                item.answered ? 'border-grass bg-grass-soft text-green-900' : 'border-line bg-surface',
                i === current && 'ring-4 ring-brand ring-offset-2',
              )}
            >
              {i + 1}
              {item.flagged ? (
                <span aria-hidden className="absolute -right-2 -top-2 text-lg">
                  🚩
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ol>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-ink-soft">
        <span>🟩 Đã làm</span>
        <span>⬜ Chưa làm</span>
        <span>🚩 Cần xem lại</span>
      </p>
    </div>
  )
}
