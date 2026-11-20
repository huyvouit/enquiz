import { motion } from 'framer-motion'
import { useState } from 'react'
import type { MatchPair } from '@/shared/api/types'
import { cn } from '@/shared/lib/cn'
import { playSfx } from '@/shared/sound'

/** One colour per pair so the child can see what is connected to what. */
const PAIR_COLORS = [
  'bg-sky-soft border-sky',
  'bg-sunny-soft border-sunny',
  'bg-grass-soft border-grass',
  'bg-grape-soft border-grape',
  'bg-coral-soft border-coral',
  'bg-brand-soft border-brand',
] as const

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Tap-to-match (works on tablets, unlike drag & drop):
 * tap a word on the left, then its partner on the right.
 * Tapping a matched item again unlinks it.
 * With `correctPairs` set (after grading) each link turns green or red.
 */
export function MatchingGame({
  lefts,
  rights,
  value,
  onChange,
  disabled = false,
  correctPairs,
}: {
  lefts: string[]
  rights: string[]
  value: MatchPair[]
  onChange: (pairs: MatchPair[]) => void
  disabled?: boolean
  correctPairs?: MatchPair[]
}) {
  const [activeLeft, setActiveLeft] = useState<string | null>(null)
  const revealed = correctPairs !== undefined
  const locked = disabled || revealed

  const pairOfLeft = (left: string) => value.find((p) => p.left === left)
  const pairOfRight = (right: string) => value.find((p) => p.right === right)
  const colorOf = (left: string) => PAIR_COLORS[lefts.indexOf(left) % PAIR_COLORS.length]
  const isPairCorrect = (p: MatchPair) =>
    !!correctPairs?.some((c) => same(c.left, p.left) && same(c.right, p.right))

  /** Colour of a linked item: pair colour while playing, green/red once graded. */
  const linkedClass = (pair: MatchPair) =>
    revealed
      ? isPairCorrect(pair)
        ? 'border-grass bg-grass-soft text-green-900'
        : 'border-coral bg-coral-soft text-rose-900'
      : colorOf(pair.left)

  function tapLeft(left: string) {
    if (locked) return
    playSfx('tap')
    if (pairOfLeft(left)) {
      onChange(value.filter((p) => p.left !== left))
      setActiveLeft(left)
      return
    }
    setActiveLeft(activeLeft === left ? null : left)
  }

  function tapRight(right: string) {
    if (locked) return
    playSfx('tap')
    const existing = pairOfRight(right)
    if (!activeLeft) {
      if (existing) onChange(value.filter((p) => p.right !== right))
      return
    }
    // A right item can only belong to one pair: replace any previous link.
    const rest = value.filter((p) => p.left !== activeLeft && p.right !== right)
    onChange([...rest, { left: activeLeft, right }])
    setActiveLeft(null)
  }

  const itemBase =
    'flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl border-4 px-3 py-3 text-center font-display text-xl font-bold shadow-pop-sm transition-colors sm:text-2xl disabled:cursor-default'

  return (
    <div>
      {!revealed ? (
        <p className="mb-3 text-center font-semibold text-ink-soft">
          {activeLeft ? `Chọn từ ghép với “${activeLeft}” 👉` : '👈 Chạm vào một ô bên trái trước'}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-4 sm:gap-8">
        <ul className="flex flex-col gap-3" aria-label="Cột trái">
          {lefts.map((left) => {
            const pair = pairOfLeft(left)
            const active = activeLeft === left
            return (
              <li key={left}>
                <motion.button
                  type="button"
                  disabled={locked}
                  whileTap={locked ? undefined : { scale: 0.94 }}
                  aria-pressed={active}
                  aria-label={pair ? `${left}, đã nối với ${pair.right}` : left}
                  onClick={() => tapLeft(left)}
                  className={cn(
                    itemBase,
                    pair ? linkedClass(pair) : 'border-line bg-surface',
                    active && 'animate-pulse border-brand ring-4 ring-brand/40',
                  )}
                >
                  {revealed && pair ? <span aria-hidden>{isPairCorrect(pair) ? '✅' : '❌'}</span> : null}
                  {left}
                </motion.button>
              </li>
            )
          })}
        </ul>
        <ul className="flex flex-col gap-3" aria-label="Cột phải">
          {rights.map((right) => {
            const pair = pairOfRight(right)
            return (
              <li key={right}>
                <motion.button
                  type="button"
                  disabled={locked}
                  whileTap={locked ? undefined : { scale: 0.94 }}
                  aria-label={pair ? `${right}, đã nối với ${pair.left}` : right}
                  onClick={() => tapRight(right)}
                  className={cn(
                    itemBase,
                    pair ? linkedClass(pair) : 'border-line bg-surface',
                    activeLeft && !pair && 'border-dashed border-brand/60',
                  )}
                >
                  {right}
                </motion.button>
              </li>
            )
          })}
        </ul>
      </div>

      {revealed && correctPairs.some((c) => !value.some((p) => same(p.left, c.left) && same(p.right, c.right))) ? (
        <div className="mt-4 rounded-2xl bg-grass-soft p-3 text-center font-bold text-green-900">
          Cặp đúng:{' '}
          {correctPairs.map((c) => (
            <span key={c.left} className="mx-1 inline-block rounded-lg bg-white px-2 py-0.5">
              {c.left} ↔ {c.right}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
