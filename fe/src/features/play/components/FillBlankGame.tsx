import { motion, useReducedMotion } from 'framer-motion'
import { useState } from 'react'
import { Button } from '@/shared/components'
import { cn } from '@/shared/lib/cn'
import { playSfx } from '@/shared/sound'
import { firstAccepted, normalizeAnswer } from '../lib/answers'
import type { PlayQuestion } from '../types'

/**
 * Fill in the blank. With a word bank (grades 1-3) the child taps a word to
 * put it in the gap and taps it again to take it out; without one, a big
 * text box. "Kiểm tra" sends the answer.
 * After grading (`correctAnswer` set) the gap turns green or red and the
 * first accepted answer is shown.
 *
 * Exam mode (`onChange` given): controlled by `value`, every change is
 * reported, no "Kiểm tra" button and no grading (plan 4.2).
 */
export function FillBlankGame({
  question,
  submitted,
  correctAnswer,
  isCorrect,
  disabled = false,
  onSubmit,
  value: controlledValue,
  onChange,
}: {
  question: PlayQuestion
  /** The answer already sent (resume / after grading / preview). */
  submitted?: string
  correctAnswer?: unknown
  isCorrect?: boolean
  disabled?: boolean
  onSubmit?: (answer: string) => void
  /** Exam mode: the current answer. */
  value?: string
  /** Exam mode: called on every change instead of "Kiểm tra". */
  onChange?: (answer: string) => void
}) {
  const [draft, setDraft] = useState(submitted ?? '')
  const reduceMotion = useReducedMotion()
  const controlled = onChange !== undefined
  const revealed = correctAnswer !== undefined
  const locked = disabled || (!controlled && (revealed || submitted !== undefined))
  const bank = question.options ?? []
  const value = controlled ? (controlledValue ?? '') : (submitted ?? draft)
  const expected = firstAccepted(correctAnswer)
  const setValue = (next: string) => (onChange ? onChange(next) : setDraft(next))

  function pick(word: string) {
    if (locked) return
    playSfx('tap')
    setValue(value === word ? '' : word)
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <motion.div
        animate={revealed && isCorrect === false && !reduceMotion ? { x: [0, -10, 10, -6, 6, 0] } : { x: 0 }}
        transition={{ duration: 0.4 }}
        className={cn(
          'flex min-h-16 min-w-48 items-center justify-center rounded-2xl border-4 border-dashed px-6 py-3 font-display text-3xl font-extrabold',
          !revealed && (value ? 'border-brand bg-brand-soft text-brand-dark' : 'border-line bg-surface text-ink-soft'),
          revealed && isCorrect && 'border-solid border-grass bg-grass-soft text-green-900',
          revealed && !isCorrect && 'border-solid border-coral bg-coral-soft text-rose-900',
        )}
        aria-live="polite"
      >
        {bank.length > 0 || locked ? (
          value || <span aria-hidden>？</span>
        ) : (
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && draft.trim() && onSubmit) onSubmit(draft.trim())
            }}
            maxLength={60}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-label="Từ cần điền"
            placeholder="Gõ từ vào đây"
            className="w-full min-w-0 bg-transparent text-center outline-none placeholder:text-lg placeholder:font-semibold placeholder:text-slate-400"
          />
        )}
      </motion.div>

      {revealed && !isCorrect && expected ? (
        <p className="font-bold">
          Đáp án đúng: <span className="text-green-700">{expected}</span>
        </p>
      ) : null}

      {bank.length > 0 ? (
        <div className="flex flex-wrap justify-center gap-3" role="group" aria-label="Từ gợi ý">
          {bank.map((word) => {
            const chosen = normalizeAnswer(value) === normalizeAnswer(word)
            return (
              <motion.button
                key={word}
                type="button"
                disabled={locked}
                onClick={() => pick(word)}
                whileTap={locked || reduceMotion ? undefined : { scale: 0.93 }}
                aria-pressed={chosen}
                className={cn(
                  'min-h-14 rounded-2xl border-4 px-5 py-2 font-display text-2xl font-bold shadow-pop-sm transition-colors',
                  chosen ? 'border-brand bg-brand text-white' : 'border-sunny bg-sunny-soft',
                  'disabled:cursor-default',
                  locked && !chosen && 'opacity-50',
                )}
              >
                {word}
              </motion.button>
            )
          })}
        </div>
      ) : null}

      {!locked && !controlled && onSubmit ? (
        <Button size="lg" variant="success" disabled={!draft.trim()} onClick={() => onSubmit(draft.trim())}>
          Kiểm tra ✔
        </Button>
      ) : null}
    </div>
  )
}
