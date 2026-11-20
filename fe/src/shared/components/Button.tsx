import { motion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '../lib/cn'

type Variant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-dark',
  secondary: 'bg-surface text-ink border-2 border-line hover:border-brand',
  success: 'bg-grass text-white hover:brightness-95',
  danger: 'bg-coral text-white hover:brightness-95',
  ghost: 'bg-transparent text-brand hover:bg-brand-soft shadow-none',
}

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-xl',
  md: 'px-5 py-2.5 text-base rounded-2xl',
  lg: 'px-7 py-3.5 text-lg rounded-2xl',
}

export interface ButtonProps extends HTMLMotionProps<'button'> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

/** Chunky, bouncy button used everywhere. */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading
  return (
    <motion.button
      type={type}
      whileHover={isDisabled ? undefined : { y: -2 }}
      whileTap={isDisabled ? undefined : { scale: 0.96, y: 1 }}
      disabled={isDisabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-bold shadow-pop-sm transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
      {children as React.ReactNode}
    </motion.button>
  )
}
