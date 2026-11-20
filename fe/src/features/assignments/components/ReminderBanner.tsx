import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Mascot } from '@/shared/components'
import { cn } from '@/shared/lib/cn'
import { playSfx } from '@/shared/sound'
import { useReminders } from '../hooks/useAssignments'
import { useNow } from '../hooks/useNow'
import { examAction, examLabel, playPath } from '../lib/play-path'
import { countdown, vnDayKey } from '../lib/vn-time'
import type { MyAssignment } from '../types'

const HIDDEN_KEY = 'enquiz-reminders-hidden-day'
const CHIMED_KEY = 'enquiz-reminders-chimed-day'

// Browser storage is a convenience: private mode or blocked storage must not break the page.
function readDay(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function writeDay(key: string) {
  try {
    localStorage.setItem(key, vnDayKey())
  } catch {
    /* ignore */
  }
}

type Kind = 'overdue' | 'dueSoon' | 'fresh'

const STYLE: Record<Kind, { box: string; icon: string; title: string }> = {
  overdue: { box: 'border-coral/50 bg-coral-soft', icon: '⏰', title: 'Bài quá hạn – em làm bù nhé!' },
  dueSoon: { box: 'border-sunny bg-sunny-soft', icon: '🔔', title: 'Sắp đến hạn' },
  fresh: { box: 'border-grape/40 bg-grape-soft', icon: '📬', title: 'Bài mới cô giao' },
}

/**
 * Student home banner (plan D9): overdue > due within 48 h > newly given.
 * Plays a soft chime at most once per Vietnam day; "Thu gọn" hides it until
 * tomorrow. Renders nothing when there is nothing to remind.
 */
export function ReminderBanner() {
  const { data } = useReminders()
  const reduce = useReducedMotion()
  const now = new Date(useNow())
  const [hiddenToday, setHiddenToday] = useState(() => readDay(HIDDEN_KEY) === vnDayKey())

  const urgent = (data?.overdue.length ?? 0) + (data?.dueSoon.length ?? 0) > 0
  useEffect(() => {
    if (!urgent || hiddenToday || readDay(CHIMED_KEY) === vnDayKey()) return
    writeDay(CHIMED_KEY)
    playSfx('tap')
  }, [urgent, hiddenToday])

  if (!data) return null
  const sections: { kind: Kind; items: MyAssignment[] }[] = (
    [
      { kind: 'overdue', items: data.overdue },
      { kind: 'dueSoon', items: data.dueSoon },
      { kind: 'fresh', items: data.fresh },
    ] as const
  ).filter((s) => s.items.length > 0)
  if (sections.length === 0) return null

  if (hiddenToday) {
    return (
      <button
        type="button"
        onClick={() => setHiddenToday(false)}
        className="mb-4 rounded-full border-2 border-line bg-surface px-4 py-1.5 text-sm font-bold text-ink-soft hover:border-brand"
      >
        📬 {data.pendingCount} bài chưa làm – xem lại nhắc nhở
      </button>
    )
  }

  const soonest = data.dueSoon[0]
  return (
    <AnimatePresence>
      <motion.section
        aria-label="Nhắc nhở bài tập"
        initial={reduce ? false : { opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 flex flex-col gap-3 rounded-blob border-2 border-line bg-surface p-4 shadow-pop"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          {soonest ? (
            <Mascot
              mood="thinking"
              message={`Bài “${soonest.quiz?.title ?? 'bài tập'}” ${countdown(soonest.dueDate, now).toLowerCase()} nữa đó!`}
            />
          ) : data.overdue.length > 0 ? (
            <Mascot mood="oops" message="Có bài đã quá hạn, em làm bù ngay nhé!" />
          ) : (
            <Mascot message="Cô vừa giao bài mới cho em!" />
          )}
          <button
            type="button"
            onClick={() => {
              writeDay(HIDDEN_KEY)
              setHiddenToday(true)
            }}
            className="rounded-xl px-3 py-1.5 text-sm font-bold text-ink-soft hover:bg-slate-100"
          >
            Thu gọn ▲
          </button>
        </div>

        {sections.map(({ kind, items }) => (
          <div key={kind} className={cn('rounded-2xl border-2 p-3', STYLE[kind].box)}>
            <h3 className="mb-2 font-display text-lg font-bold">
              {STYLE[kind].icon} {STYLE[kind].title}
            </h3>
            <ul className="flex flex-col gap-2">
              {items.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-surface/80 px-3 py-2">
                  <span className="text-3xl" aria-hidden>
                    {a.quiz?.coverEmoji ?? '📬'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 font-bold">
                      {a.quiz?.title ?? '(Bài đã bị xoá)'}
                      {a.mode === 'exam' ? <Badge tone="sky">{examLabel(a)}</Badge> : null}
                      {kind === 'fresh' ? <Badge tone="grape">✨ Mới</Badge> : null}
                    </div>
                    <div className="text-sm text-ink-soft">
                      {a.className} ·{' '}
                      <span className={kind === 'overdue' ? 'font-bold text-rose-700' : 'font-bold'}>
                        {countdown(a.dueDate, now)}
                      </span>
                    </div>
                    {a.note ? <div className="text-sm italic">💬 “{a.note}”</div> : null}
                  </div>
                  {a.quiz ? (
                    <Link
                      to={playPath(a)}
                      className="flex min-h-11 items-center rounded-xl bg-grass px-4 py-2 font-bold text-white shadow-pop-sm hover:brightness-95"
                    >
                      {a.mode === 'exam' ? examAction(a) : kind === 'overdue' ? '✏️ Làm bù' : '▶ Làm ngay'}
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}

        <Link to="/assignments" className="self-end text-sm font-bold text-brand hover:underline">
          Xem tất cả bài tập ({data.pendingCount} chưa làm) →
        </Link>
      </motion.section>
    </AnimatePresence>
  )
}
