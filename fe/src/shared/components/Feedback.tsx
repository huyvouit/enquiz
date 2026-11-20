import type { ReactNode } from 'react'
import { Button } from './Button'

export function Spinner({ label = 'Đang tải...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-ink-soft" role="status">
      <span className="size-10 animate-spin rounded-full border-4 border-brand border-t-transparent" />
      <span className="font-semibold">{label}</span>
    </div>
  )
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-2xl border-2 border-coral/40 bg-coral-soft p-5 text-center font-semibold text-coral"
    >
      <span>😵 {message}</span>
      {onRetry ? (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Thử lại
        </Button>
      ) : null}
    </div>
  )
}

export function EmptyState({
  emoji = '🦉',
  title,
  children,
}: {
  emoji?: string
  title: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-blob border-2 border-dashed border-line bg-surface/70 px-6 py-12 text-center">
      <span className="text-5xl" aria-hidden>
        {emoji}
      </span>
      <p className="font-display text-xl font-bold">{title}</p>
      {children ? <div className="text-ink-soft">{children}</div> : null}
    </div>
  )
}

export function Badge({
  tone = 'brand',
  children,
}: {
  tone?: 'brand' | 'grass' | 'sunny' | 'coral' | 'sky' | 'grape' | 'neutral'
  children: ReactNode
}) {
  const tones = {
    brand: 'bg-brand-soft text-brand-dark',
    grass: 'bg-grass-soft text-green-700',
    sunny: 'bg-sunny-soft text-yellow-800',
    coral: 'bg-coral-soft text-rose-700',
    sky: 'bg-sky-soft text-sky-800',
    grape: 'bg-grape-soft text-purple-800',
    neutral: 'bg-slate-100 text-slate-600',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${tones[tone]}`}>
      {children}
    </span>
  )
}
