import { cn } from '@/shared/lib/cn'
import { formatClock } from '../hooks/useExamClock'

/** Warning colours: orange from 2 minutes left, red from 1 minute. */
export const WARN_SEC = 120
export const DANGER_SEC = 60

export function Countdown({ secondsLeft }: { secondsLeft: number }) {
  const level = secondsLeft <= DANGER_SEC ? 'danger' : secondsLeft <= WARN_SEC ? 'warn' : 'ok'
  return (
    <div
      role="timer"
      aria-label={`Còn ${Math.floor(secondsLeft / 60)} phút ${secondsLeft % 60} giây`}
      className={cn(
        'flex min-h-12 items-center gap-1.5 rounded-2xl border-2 px-3 font-display text-2xl font-extrabold tabular-nums',
        level === 'ok' && 'border-sky bg-sky-soft text-sky-900',
        level === 'warn' && 'border-sunny bg-sunny-soft text-amber-800',
        level === 'danger' && 'border-coral bg-coral text-white motion-safe:animate-pulse',
      )}
    >
      <span aria-hidden>⏱</span>
      {formatClock(secondsLeft)}
    </div>
  )
}
