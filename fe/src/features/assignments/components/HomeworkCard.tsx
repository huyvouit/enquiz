import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Badge } from '@/shared/components'
import { cn } from '@/shared/lib/cn'
import { useNow } from '../hooks/useNow'
import { playPath } from '../lib/play-path'
import { countdown, formatDue } from '../lib/vn-time'
import type { MyAssignment } from '../types'
import { StateChip } from './StateParts'

/** One homework as a big, tappable card for the student. */
export function HomeworkCard({ assignment: a }: { assignment: MyAssignment }) {
  const reduce = useReducedMotion()
  const now = new Date(useNow())
  const submitted = a.score !== null
  const playable = !a.closed && a.quiz !== null
  const label = a.closed
    ? '🔒 Cô đã đóng bài'
    : !a.quiz
      ? 'Bài đã bị xoá'
      : submitted
        ? '🔁 Làm lại'
        : a.state === 'missing'
          ? '✏️ Làm bù'
          : '▶ Làm ngay'

  return (
    <motion.li
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex flex-col gap-3 rounded-blob border-2 bg-surface p-4 shadow-pop-sm sm:flex-row sm:items-center',
        a.state === 'missing' ? 'border-coral/50' : a.dueSoon ? 'border-sunny' : 'border-line',
      )}
    >
      <span className="text-5xl" aria-hidden>
        {a.quiz?.coverEmoji ?? '📬'}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-xl font-bold">{a.quiz?.title ?? '(Bài đã bị xoá)'}</span>
          {a.isNew ? <Badge tone="grape">✨ Mới</Badge> : null}
          <StateChip state={a.state} />
        </div>
        <div className="text-sm text-ink-soft">
          {a.className}
          {a.teacherName ? ` · ${a.teacherName}` : ''} · Hạn {formatDue(a.dueDate)}
        </div>
        {!submitted ? (
          <div
            className={cn(
              'w-fit rounded-full px-3 py-0.5 text-sm font-bold',
              a.state === 'missing' ? 'bg-coral-soft text-rose-700' : 'bg-sunny-soft text-yellow-800',
            )}
          >
            ⏰ {countdown(a.dueDate, now)}
          </div>
        ) : (
          <div className="font-bold text-green-700">
            Điểm của em: <span className="font-display text-2xl">{a.score}</span>
          </div>
        )}
        {a.note ? (
          <div className="relative mt-1 w-fit max-w-full rounded-2xl border-2 border-line bg-canvas px-3 py-1.5 text-sm font-semibold">
            💬 {a.teacherName || 'Cô'}: “{a.note}”
          </div>
        ) : null}
      </div>
      {playable ? (
        <Link
          to={playPath(a)}
          className={cn(
            'flex min-h-14 items-center justify-center rounded-2xl px-6 py-3 text-lg font-bold text-white shadow-pop-sm transition-transform hover:-translate-y-0.5',
            submitted ? 'bg-brand' : 'bg-grass',
          )}
        >
          {label}
        </Link>
      ) : (
        <span className="rounded-2xl bg-slate-100 px-4 py-3 text-center font-bold text-slate-500">{label}</span>
      )}
    </motion.li>
  )
}
