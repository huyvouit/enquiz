import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/shared/lib/cn'
import { OPTION_BARS, OPTION_COLORS, OPTION_SHAPES } from '../lib/options'
import type { LiveStanding } from '../types'

/** Answer tiles as shown on the projector; `correctIndex` highlights the right one. */
export function OptionTiles({
  options,
  correctIndex,
  size = 'lg',
}: {
  options: string[]
  correctIndex?: number
  size?: 'md' | 'lg'
}) {
  const revealed = correctIndex !== undefined
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map((option, i) => {
        const right = revealed && i === correctIndex
        return (
          <div
            key={`${i}-${option}`}
            className={cn(
              'flex items-center gap-4 rounded-2xl border-4 px-5 font-display font-extrabold shadow-pop-sm transition-opacity',
              OPTION_COLORS[i % OPTION_COLORS.length],
              size === 'lg' ? 'min-h-20 py-4 text-3xl lg:text-4xl' : 'min-h-14 py-2 text-xl',
              revealed && !right && 'opacity-40',
              right && 'ring-4 ring-grass ring-offset-2',
            )}
          >
            <span aria-hidden>{right ? '✅' : OPTION_SHAPES[i % OPTION_SHAPES.length]}</span>
            <span className="min-w-0 flex-1 break-words">{option}</span>
          </div>
        )
      })}
    </div>
  )
}

/** How many chose each option, one coloured bar per option. */
export function DistributionBars({
  options,
  distribution,
  correctIndex,
  compact = false,
}: {
  options: string[]
  distribution: number[]
  correctIndex: number
  compact?: boolean
}) {
  const max = Math.max(1, ...distribution)
  return (
    <div className={cn('flex items-end justify-center gap-4', compact ? 'h-32' : 'h-56')}>
      {options.map((option, i) => {
        const count = distribution[i] ?? 0
        return (
          <div key={`${i}-${option}`} className="flex h-full w-20 flex-col items-center justify-end gap-1 sm:w-28">
            <span className={cn('font-display font-extrabold', compact ? 'text-lg' : 'text-3xl')}>{count}</span>
            <div
              className={cn(
                'w-full rounded-t-xl transition-all',
                OPTION_BARS[i % OPTION_BARS.length],
                i !== correctIndex && 'opacity-50',
              )}
              style={{ height: `${Math.max(4, (count / max) * 100)}%` }}
            />
            <span className={compact ? 'text-base' : 'text-2xl'} aria-hidden>
              {i === correctIndex ? '✅' : OPTION_SHAPES[i % OPTION_SHAPES.length]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** Top players between questions. `highlight` marks the viewer's own row. */
export function Leaderboard({ top, highlight }: { top: LiveStanding[]; highlight?: string }) {
  const reduceMotion = useReducedMotion()
  return (
    <ol className="mx-auto flex w-full max-w-3xl flex-col gap-3">
      {top.map((s, i) => (
        <motion.li
          key={s.playerId}
          layout={!reduceMotion}
          initial={reduceMotion ? false : { opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.08 }}
          className={cn(
            'flex items-center gap-4 rounded-2xl border-2 bg-surface px-5 py-3 shadow-pop-sm',
            s.playerId === highlight ? 'border-brand bg-brand-soft' : 'border-line',
          )}
        >
          <span className="w-12 text-center font-display text-3xl font-extrabold text-brand">
            {s.rank <= 3 ? ['🥇', '🥈', '🥉'][s.rank - 1] : s.rank}
          </span>
          <span className="min-w-0 flex-1 truncate text-2xl font-bold">{s.nickname}</span>
          <span className="font-display text-2xl font-extrabold tabular-nums">{s.score}</span>
        </motion.li>
      ))}
    </ol>
  )
}

/** Top 3 on steps: 2nd left, 1st centre (tallest), 3rd right. */
export function Podium({ top }: { top: LiveStanding[] }) {
  const reduceMotion = useReducedMotion()
  const places = [
    { s: top[1], height: 'h-36 sm:h-44', medal: '🥈', delay: 0.4 },
    { s: top[0], height: 'h-48 sm:h-60', medal: '🥇', delay: 0.8 },
    { s: top[2], height: 'h-28 sm:h-32', medal: '🥉', delay: 0 },
  ]
  return (
    <div className="mx-auto flex w-full max-w-3xl items-end justify-center gap-3 sm:gap-6">
      {places.map(({ s, height, medal, delay }, i) => (
        <div key={i} className="flex w-1/3 flex-col items-center gap-2">
          {s ? (
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: delay + 0.3 }}
              className="text-center"
            >
              <p className="text-5xl" aria-hidden>
                {medal}
              </p>
              <p className="break-words text-xl font-extrabold sm:text-2xl">{s.nickname}</p>
              <p className="font-display text-lg font-bold text-ink-soft">{s.score} điểm</p>
            </motion.div>
          ) : null}
          <motion.div
            initial={reduceMotion ? false : { scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ delay, duration: 0.5 }}
            style={{ originY: 1 }}
            className={cn(
              'flex w-full items-start justify-center rounded-t-2xl pt-3 font-display text-4xl font-extrabold text-white',
              height,
              i === 1 ? 'bg-sunny' : i === 0 ? 'bg-sky' : 'bg-coral',
              !s && 'opacity-30',
            )}
          >
            {i === 1 ? 1 : i === 0 ? 2 : 3}
          </motion.div>
        </div>
      ))}
    </div>
  )
}
