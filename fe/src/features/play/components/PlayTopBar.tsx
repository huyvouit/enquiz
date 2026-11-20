import { AnimatePresence, motion } from 'framer-motion'

export function PlayTopBar({
  done,
  total,
  correct,
  streak = 0,
  onQuit,
}: {
  /** Questions answered so far. */
  done: number
  total: number
  /** Correct answers so far (omit in preview mode). */
  correct?: number
  /** Current run of consecutive correct answers. */
  streak?: number
  onQuit: () => void
}) {
  const percent = total === 0 ? 0 : (done / total) * 100
  return (
    <div className="mb-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onQuit}
          aria-label="Thoát"
          className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-line bg-surface text-xl font-bold hover:border-coral"
        >
          ✕
        </button>
        <div
          className="h-5 flex-1 overflow-hidden rounded-full border-2 border-line bg-surface"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
        >
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-grass to-sunny"
            animate={{ width: `${percent}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          />
        </div>
        <span className="shrink-0 font-display text-lg font-bold">
          {done}/{total}
        </span>
        {correct !== undefined ? (
          <span className="shrink-0 rounded-full bg-grass-soft px-3 py-1 font-display font-bold text-green-800">
            ✅ {correct}
          </span>
        ) : null}
      </div>
      <AnimatePresence>
        {streak >= 3 ? (
          <motion.p
            key={streak}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="mt-2 text-center font-display text-lg font-extrabold text-orange-500"
          >
            🔥 {streak} câu đúng liên tiếp!
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
