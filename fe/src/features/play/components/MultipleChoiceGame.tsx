import { motion } from 'framer-motion'
import { cn } from '@/shared/lib/cn'

const COLORS = [
  'bg-sky-soft border-sky',
  'bg-sunny-soft border-sunny',
  'bg-grass-soft border-grass',
  'bg-grape-soft border-grape',
  'bg-coral-soft border-coral',
  'bg-brand-soft border-brand',
] as const
const SHAPES = ['🔷', '⭐', '🟢', '💜', '❤️', '🔶'] as const

/**
 * Big, colourful, tablet-friendly answer buttons.
 * With `correctAnswer` set (after grading), the right option turns green and a
 * wrong choice turns red; everything becomes read-only.
 */
export function MultipleChoiceGame({
  options,
  value,
  onChange,
  disabled = false,
  correctAnswer,
  selectedIcon = '⏳',
}: {
  options: string[]
  value: string | undefined
  onChange: (option: string) => void
  disabled?: boolean
  correctAnswer?: string
  /** Mark of the chosen option before grading: ⏳ in practice, ✔️ in exams. */
  selectedIcon?: string
}) {
  const revealed = correctAnswer !== undefined
  return (
    <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Các đáp án">
      {options.map((option, i) => {
        const selected = value === option
        const isRight = revealed && option === correctAnswer
        const isWrongPick = revealed && selected && !isRight
        return (
          <motion.button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled || revealed}
            onClick={() => onChange(option)}
            whileHover={disabled || revealed ? undefined : { y: -3 }}
            whileTap={disabled || revealed ? undefined : { scale: 0.95 }}
            animate={
              isWrongPick
                ? { x: [0, -10, 10, -6, 6, 0] }
                : isRight
                  ? { scale: [1, 1.08, 1] }
                  : selected
                    ? { scale: [1, 1.06, 1] }
                    : { scale: 1 }
            }
            transition={{ duration: 0.4 }}
            className={cn(
              'flex min-h-20 items-center gap-3 rounded-2xl border-4 px-5 py-4 text-left font-display text-xl font-bold shadow-pop-sm transition-colors sm:text-2xl',
              !revealed && COLORS[i % COLORS.length],
              !revealed && (selected ? 'ring-4 ring-brand ring-offset-2' : 'border-transparent'),
              isRight && 'border-grass bg-grass-soft text-green-900',
              isWrongPick && 'border-coral bg-coral-soft text-rose-900',
              revealed && !isRight && !isWrongPick && 'border-transparent bg-slate-100 opacity-50',
              'disabled:cursor-default',
            )}
          >
            <span aria-hidden className="text-2xl">
              {isRight ? '✅' : isWrongPick ? '❌' : selected ? selectedIcon : SHAPES[i % SHAPES.length]}
            </span>
            {option}
          </motion.button>
        )
      })}
    </div>
  )
}
