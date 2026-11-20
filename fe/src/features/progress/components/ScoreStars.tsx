import { motion } from 'framer-motion'
import { cn } from '@/shared/lib/cn'
import { starsForScore } from '@/shared/lib/format'

/** 3 stars, filled according to the score. `animate` pops them in one by one. */
export function ScoreStars({
  score,
  size = 'md',
  animate = false,
}: {
  score: number
  size?: 'sm' | 'md' | 'lg'
  animate?: boolean
}) {
  const filled = starsForScore(score)
  const sizes = { sm: 'text-base', md: 'text-2xl', lg: 'text-6xl' }
  return (
    <div className={cn('flex gap-1', sizes[size])} aria-label={`${filled} trên 3 sao`}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          aria-hidden
          initial={animate ? { scale: 0, rotate: -90 } : false}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: animate ? 0.3 + i * 0.25 : 0, type: 'spring', stiffness: 260, damping: 12 }}
          className={cn(i < filled ? '' : 'opacity-25 grayscale')}
        >
          ⭐
        </motion.span>
      ))}
    </div>
  )
}
