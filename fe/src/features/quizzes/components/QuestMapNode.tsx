import { motion, useAnimationControls } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ScoreStars, type QuestMapStation } from '@/features/progress'
import { cn } from '@/shared/lib/cn'
import { playSfx } from '@/shared/sound'

const NODE_COLORS = ['bg-sunny', 'bg-sky', 'bg-grass', 'bg-grape', 'bg-coral'] as const
const OFFSETS = ['sm:-translate-x-24', 'sm:translate-x-0', 'sm:translate-x-24', 'sm:translate-x-0'] as const

/**
 * One station on the quest map.
 * - passed:   coloured, ✓ badge, best-score stars
 * - unlocked: coloured and bouncing — "play me next"
 * - locked:   grey with a padlock; tapping it wiggles and explains why
 */
export function QuestMapNode({
  station,
  index,
  onLockedTap,
}: {
  station: QuestMapStation
  index: number
  onLockedTap: () => void
}) {
  const wiggle = useAnimationControls()
  const locked = station.status === 'locked'
  const isNext = station.status === 'unlocked'

  const bubble = (
    <motion.span
      animate={isNext ? { y: [0, -8, 0] } : undefined}
      transition={isNext ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : undefined}
      whileHover={locked ? undefined : { scale: 1.1, rotate: -4 }}
      whileTap={{ scale: 0.92 }}
      className={cn(
        'relative grid size-24 place-items-center rounded-full border-4 border-white text-5xl shadow-pop ring-4 ring-transparent group-focus-visible:ring-brand',
        locked ? 'bg-slate-300 grayscale' : NODE_COLORS[index % NODE_COLORS.length],
        isNext && 'ring-brand/50',
      )}
    >
      <span className={cn(locked && 'opacity-40')}>{station.coverEmoji}</span>
      {locked ? (
        <span className="absolute -right-1 -bottom-1 grid size-9 place-items-center rounded-full bg-white text-xl shadow">
          🔒
        </span>
      ) : null}
      {station.status === 'passed' ? (
        <span className="absolute -right-1 -bottom-1 grid size-9 place-items-center rounded-full bg-grass text-xl text-white shadow">
          ✓
        </span>
      ) : null}
    </motion.span>
  )

  const label = (
    <>
      <span
        className={cn(
          'max-w-44 rounded-xl bg-surface px-3 py-1 text-center font-display text-lg font-bold leading-tight shadow-pop-sm',
          locked && 'text-ink-soft',
        )}
      >
        {station.title}
      </span>
      {station.status === 'passed' && station.bestScore !== null ? (
        <ScoreStars score={station.bestScore} size="sm" />
      ) : isNext ? (
        <span className="rounded-full bg-brand px-3 py-0.5 text-xs font-bold text-white">▶ Chơi ngay</span>
      ) : (
        <span className="text-xs font-bold text-ink-soft">
          {locked ? 'Chưa mở khoá' : `${station.questionCount} câu`}
        </span>
      )}
    </>
  )

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.08, type: 'spring', stiffness: 220, damping: 16 }}
      className={cn('flex flex-col items-center', OFFSETS[index % OFFSETS.length])}
    >
      {locked ? (
        <motion.button
          type="button"
          animate={wiggle}
          aria-label={`${station.title} – chưa mở khoá`}
          onClick={() => {
            playSfx('locked')
            void wiggle.start({ x: [0, -10, 10, -6, 6, 0], transition: { duration: 0.4 } })
            onLockedTap()
          }}
          className="group flex cursor-not-allowed flex-col items-center gap-2 focus:outline-none"
        >
          {bubble}
          {label}
        </motion.button>
      ) : (
        <Link
          to={`/play/${station.id}`}
          aria-label={`Chơi ${station.title}`}
          onClick={() => playSfx('tap')}
          className="group flex flex-col items-center gap-2 focus:outline-none"
        >
          {bubble}
          {label}
        </Link>
      )}
    </motion.div>
  )
}
