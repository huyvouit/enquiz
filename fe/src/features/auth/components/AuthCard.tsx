import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { Mascot } from '@/shared/components'

/** Centered card layout shared by the login and register pages. */
export function AuthCard({ title, mascotSays, children }: { title: string; mascotSays: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <p className="font-display text-5xl font-extrabold text-brand">
          En<span className="text-sunny drop-shadow-[0_2px_0_rgba(0,0,0,0.15)]">Quiz</span>
        </p>
        <p className="font-semibold text-ink-soft">Vừa học vừa chơi tiếng Anh</p>
      </div>
      <Mascot message={mascotSays} className="mb-4" />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-blob border-2 border-line bg-surface p-6 shadow-pop"
      >
        <h1 className="mb-4 text-2xl font-extrabold">{title}</h1>
        {children}
      </motion.div>
    </div>
  )
}
