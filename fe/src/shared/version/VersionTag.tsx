import { cn } from '@/shared/lib/cn'
import { APP_VERSION, GIT_COMMIT } from './constants'

/**
 * "EnQuiz v1.0.0": small print in the footer, so a teacher reporting a
 * problem can say which release they use. The commit is in the tooltip.
 */
export function VersionTag({ className }: { className?: string }) {
  return (
    <p className={cn('text-center text-xs text-ink-soft/80', className)} title={`commit ${GIT_COMMIT}`}>
      EnQuiz v{APP_VERSION}
    </p>
  )
}
