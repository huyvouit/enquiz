import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { Badge } from '@/shared/components'
import type { QuizSummary } from '../types'

/** Teacher-side card: info + action buttons. */
export function QuizCard({ quiz, actions }: { quiz: QuizSummary; actions?: ReactNode }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-3 rounded-blob border-2 border-line bg-surface p-5 shadow-pop"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-sunny-soft text-3xl" aria-hidden>
          {quiz.coverEmoji}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-xl font-bold">{quiz.title}</h3>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge tone="sunny">{quiz.topic}</Badge>
            <Badge tone="neutral">Lớp {quiz.gradeLevel}</Badge>
            <Badge tone="sky">{quiz.questionCount} câu</Badge>
            {quiz.status === 'draft' ? <Badge tone="coral">Nháp</Badge> : <Badge tone="grass">Đã xuất bản</Badge>}
          </div>
        </div>
      </div>
      {quiz.description ? <p className="text-sm text-ink-soft">{quiz.description}</p> : null}
      <p className="text-xs font-semibold text-ink-soft">
        {quiz.author ? `👩‍🏫 ${quiz.author.fullName}` : '🏫 Kho hệ thống'}
      </p>
      {actions ? <div className="mt-auto flex flex-wrap gap-2">{actions}</div> : null}
    </motion.div>
  )
}
