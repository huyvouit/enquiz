import { motion } from 'framer-motion'
import { cn } from '../lib/cn'

type Mood = 'happy' | 'thinking' | 'cheer' | 'oops'

const faces: Record<Mood, string> = {
  happy: '🦉',
  thinking: '🤔',
  cheer: '🥳',
  oops: '🙈',
}

/** "Cú Mèo Ollie" — the guide character with a speech bubble. */
export function Mascot({
  message,
  mood = 'happy',
  className,
}: {
  message?: string
  mood?: Mood
  className?: string
}) {
  return (
    <div className={cn('flex items-end gap-3', className)}>
      <motion.span
        aria-hidden
        className="select-none text-5xl sm:text-6xl"
        animate={{ y: [0, -8, 0], rotate: [0, -4, 4, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        {faces[mood]}
      </motion.span>
      {message ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, x: -10 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          className="relative rounded-2xl border-2 border-line bg-surface px-4 py-2.5 font-bold shadow-pop-sm"
        >
          <span className="absolute -left-2 bottom-3 size-3 rotate-45 border-b-2 border-l-2 border-line bg-surface" />
          {message}
        </motion.div>
      ) : null}
    </div>
  )
}
