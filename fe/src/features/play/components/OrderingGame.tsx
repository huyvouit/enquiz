import { motion, useReducedMotion } from 'framer-motion'
import { useState } from 'react'
import { Button } from '@/shared/components'
import { cn } from '@/shared/lib/cn'
import { playSfx } from '@/shared/sound'
import { normalizeAnswer, orderedPieces } from '../lib/answers'
import type { PlayQuestion } from '../types'

/**
 * Sentence building by tapping (no drag & drop, works on tablets): tap a
 * tile to append it to the sentence line, tap a placed tile to send it back.
 * Tiles are tracked by index so repeated words ("the ... the") work.
 * After grading, each placed tile turns green (right position) or red, and
 * the correct sentence is shown when wrong.
 */
export function OrderingGame({
  question,
  submitted,
  correctAnswer,
  isCorrect,
  disabled = false,
  onSubmit,
}: {
  question: PlayQuestion
  submitted?: string[]
  correctAnswer?: unknown
  isCorrect?: boolean
  disabled?: boolean
  onSubmit: (answer: string[]) => void
}) {
  const items = question.ordering?.items ?? []
  const reduceMotion = useReducedMotion()
  // Indexes into `items`, in the order the child placed them.
  const [placed, setPlaced] = useState<number[]>(() => (submitted ? indexesOf(items, submitted) : []))
  const revealed = correctAnswer !== undefined
  const locked = disabled || revealed || submitted !== undefined
  const correct = orderedPieces(correctAnswer)
  const sentence = submitted ?? placed.map((i) => items[i])

  function place(i: number) {
    if (locked) return
    playSfx('tap')
    setPlaced((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]))
  }

  const tileClass =
    'min-h-14 rounded-2xl border-4 px-4 py-2 font-display text-2xl font-bold shadow-pop-sm transition-colors disabled:cursor-default'

  return (
    <div className="flex flex-col items-center gap-5">
      <motion.div
        animate={revealed && isCorrect === false && !reduceMotion ? { x: [0, -10, 10, -6, 6, 0] } : { x: 0 }}
        transition={{ duration: 0.4 }}
        className="flex min-h-20 w-full flex-wrap items-center justify-center gap-2 rounded-2xl border-4 border-dashed border-line bg-surface p-3"
        aria-label="Câu của em"
      >
        {sentence.length === 0 ? (
          <span className="font-semibold text-ink-soft">Chạm vào các thẻ bên dưới để xếp câu 👇</span>
        ) : null}
        {sentence.map((word, pos) => {
          const right = revealed && normalizeAnswer(word) === normalizeAnswer(correct[pos] ?? '')
          return (
            <motion.button
              key={`${pos}-${word}`}
              layout={!reduceMotion}
              type="button"
              disabled={locked}
              onClick={() => place(placed[pos])}
              className={cn(
                tileClass,
                !revealed && 'border-brand bg-brand-soft',
                revealed && right && 'border-grass bg-grass-soft text-green-900',
                revealed && !right && 'border-coral bg-coral-soft text-rose-900',
              )}
            >
              {word}
            </motion.button>
          )
        })}
      </motion.div>

      {revealed && !isCorrect && correct.length > 0 ? (
        <p className="text-center font-bold">
          Câu đúng: <span className="text-green-700">{correct.join(' ')}</span>
        </p>
      ) : null}

      {!locked ? (
        <div className="flex flex-wrap justify-center gap-3" role="group" aria-label="Các thẻ từ">
          {items.map((word, i) =>
            placed.includes(i) ? (
              <span key={i} aria-hidden className={cn(tileClass, 'border-transparent bg-slate-100 text-transparent shadow-none')}>
                {word}
              </span>
            ) : (
              <motion.button
                key={i}
                layout={!reduceMotion}
                type="button"
                onClick={() => place(i)}
                whileTap={reduceMotion ? undefined : { scale: 0.93 }}
                className={cn(tileClass, 'border-sunny bg-sunny-soft')}
              >
                {word}
              </motion.button>
            ),
          )}
        </div>
      ) : null}

      {!locked ? (
        <Button
          size="lg"
          variant="success"
          disabled={placed.length !== items.length || items.length === 0}
          onClick={() => onSubmit(placed.map((i) => items[i]))}
        >
          Kiểm tra ✔
        </Button>
      ) : null}
    </div>
  )
}

/** Maps a submitted sentence back to tile indexes (for resumed sessions). */
function indexesOf(items: string[], words: string[]): number[] {
  const used = new Set<number>()
  return words.flatMap((w) => {
    const i = items.findIndex((item, idx) => !used.has(idx) && item === w)
    if (i === -1) return []
    used.add(i)
    return [i]
  })
}
