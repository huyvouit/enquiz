import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '../lib/cn'

const control =
  'w-full rounded-xl border-2 border-line bg-surface px-3.5 py-2.5 font-semibold text-ink placeholder:text-slate-400 focus:border-brand focus:outline-none'

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-sm font-bold text-ink">{label}</span>
      {children}
      {hint ? <span className="text-xs text-ink-soft">{hint}</span> : null}
    </label>
  )
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, className)} {...rest} />
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, 'min-h-20 resize-y', className)} {...rest} />
}

export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(control, 'cursor-pointer', className)} {...rest} />
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-3 font-semibold">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-7 w-12 rounded-full transition-colors',
          checked ? 'bg-grass' : 'bg-slate-300',
        )}
      >
        <span
          className={cn(
            'absolute top-1 size-5 rounded-full bg-white shadow transition-all',
            checked ? 'left-6' : 'left-1',
          )}
        />
      </button>
      {label}
    </label>
  )
}
