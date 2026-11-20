import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { useAuthStore } from '@/features/auth'
import { useMyClasses, useTeachingClasses } from '@/features/classes'
import { errorMessage } from '@/shared/api/http'
import { GRADE_LEVELS } from '@/shared/api/types'
import { EmptyState, ErrorBox, PageHeader, Select, Spinner } from '@/shared/components'
import { cn } from '@/shared/lib/cn'
import { progressApi } from '../api/progress.api'
import type { LeaderboardEntry, LeaderboardPeriod, LeaderboardScope } from '../types'

const PERIODS: { value: LeaderboardPeriod; label: string }[] = [
  { value: 'week', label: 'Tuần này' },
  { value: 'month', label: 'Tháng này' },
  { value: 'all', label: 'Mọi lúc' },
]
const MEDALS = ['🥇', '🥈', '🥉']
const PODIUM_STYLE = [
  'h-36 bg-sunny', // 1st
  'h-28 bg-slate-300', // 2nd
  'h-24 bg-amber-600/70', // 3rd
]

/**
 * /leaderboard — students ranked by XP, either in one class (full names,
 * default when the student/teacher has a class) or across a grade (short names).
 */
export function LeaderboardPage() {
  const user = useAuthStore((s) => s.user)
  const isStudent = user?.role === 'student'
  const [period, setPeriod] = useState<LeaderboardPeriod>('week')
  const [grade, setGrade] = useState(user?.studentProfile?.gradeLevel ?? 1)
  const [chosenScope, setChosenScope] = useState<LeaderboardScope | null>(null)
  const [chosenClass, setChosenClass] = useState<string | null>(null)

  const studentClasses = useMyClasses()
  const teacherClasses = useTeachingClasses(false, !isStudent)
  const classes = (isStudent ? studentClasses.data : teacherClasses.data) ?? []
  const classId = chosenClass && classes.some((c) => c.id === chosenClass) ? chosenClass : (classes[0]?.id ?? null)
  const scope: LeaderboardScope = classId ? (chosenScope ?? 'class') : 'grade'
  const classesLoading = isStudent ? studentClasses.isPending : teacherClasses.isPending

  const board = useQuery({
    queryKey: ['leaderboard', period, scope, scope === 'class' ? classId : grade],
    queryFn: () =>
      scope === 'class' && classId
        ? progressApi.leaderboard(period, { scope: 'class', classId })
        : progressApi.leaderboard(period, { scope: 'grade', gradeLevel: grade }),
    enabled: !classesLoading,
  })

  const entries = board.data?.entries ?? []
  const top3 = entries.slice(0, 3)
  const rest = entries.slice(3)
  const me = board.data?.me
  const meInTop = !!me && entries.some((e) => e.studentId === me.studentId)
  const loading = classesLoading || board.isPending

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="🏆 Bảng xếp hạng"
        subtitle="Xếp theo XP: mỗi lần em phá kỷ lục điểm của một bài là được thêm XP"
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {classes.length > 0 ? (
          <Tabs
            value={scope}
            onChange={setChosenScope}
            options={[
              { value: 'class', label: isStudent ? '🏫 Lớp của em' : '🏫 Lớp của tôi' },
              { value: 'grade', label: '🌏 Toàn khối' },
            ]}
          />
        ) : null}
        {scope === 'class' && classes.length > 1 ? (
          <Select
            aria-label="Lớp"
            value={classId ?? ''}
            onChange={(e) => setChosenClass(e.target.value)}
            className="w-auto!"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        ) : null}
        {scope === 'grade' ? (
          <Select
            aria-label="Khối lớp"
            value={grade}
            onChange={(e) => setGrade(Number(e.target.value))}
            className="w-auto!"
          >
            {GRADE_LEVELS.map((g) => (
              <option key={g} value={g}>
                Khối {g}
              </option>
            ))}
          </Select>
        ) : null}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Tabs value={period} onChange={setPeriod} options={PERIODS} />
      </div>

      {scope === 'grade' && !loading ? (
        <p className="mb-4 text-sm font-semibold text-ink-soft">
          Bảng toàn khối gồm học sinh nhiều trường, nên tên các bạn được viết gọn (ví dụ “Anh N.”).
        </p>
      ) : null}
      {scope === 'class' && board.data?.className ? (
        <p className="mb-4 font-bold text-ink-soft">Lớp {board.data.className}</p>
      ) : null}

      {loading ? <Spinner /> : null}
      {board.error ? <ErrorBox message={errorMessage(board.error)} onRetry={() => void board.refetch()} /> : null}
      {!loading && !board.error && entries.length === 0 ? (
        <EmptyState emoji="🏁" title="Chưa có ai ghi điểm">
          Hãy là người đầu tiên lên bảng xếp hạng!
        </EmptyState>
      ) : null}

      {!loading && top3.length > 0 ? (
        <div className="mb-8 flex items-end justify-center gap-3 sm:gap-6">
          {/* Visual order: 2nd, 1st, 3rd */}
          {[1, 0, 2].map((i) =>
            top3[i] ? (
              <Podium key={top3[i].studentId} entry={top3[i]} place={i} isMe={top3[i].studentId === me?.studentId} />
            ) : null,
          )}
        </div>
      ) : null}

      {!loading && rest.length > 0 ? (
        <ol className="flex flex-col gap-2">
          {rest.map((e) => (
            <Row key={e.studentId} entry={e} isMe={e.studentId === me?.studentId} />
          ))}
        </ol>
      ) : null}

      {!loading && me && !meInTop ? (
        <div className="mt-6">
          <p className="mb-2 text-sm font-bold text-ink-soft">Vị trí của em</p>
          <Row entry={me} isMe />
        </div>
      ) : null}
    </div>
  )
}

function Tabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="inline-flex rounded-2xl border-2 border-line bg-surface p-1" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'min-h-11 rounded-xl px-4 py-2 font-bold transition-colors',
            value === o.value ? 'bg-brand text-white' : 'text-ink-soft hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Podium({ entry, place, isMe }: { entry: LeaderboardEntry; place: number; isMe: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 * (2 - place), type: 'spring' }}
      className="flex w-24 flex-col items-center gap-1 sm:w-32"
    >
      <span className="text-4xl" aria-hidden>
        {MEDALS[entry.rank - 1] ?? '🏅'}
      </span>
      <span className={cn('line-clamp-2 text-center font-bold leading-tight', isMe && 'text-brand')}>
        {entry.fullName}
        {isMe ? ' (em)' : ''}
      </span>
      <span className="text-sm font-bold text-ink-soft">⚡ {entry.xp} XP</span>
      <div
        className={cn(
          'mt-1 flex w-full items-start justify-center rounded-t-2xl pt-2 font-display text-3xl font-extrabold text-white shadow-pop-sm',
          PODIUM_STYLE[place],
        )}
      >
        {entry.rank}
      </div>
    </motion.div>
  )
}

function Row({ entry, isMe }: { entry: LeaderboardEntry; isMe: boolean }) {
  return (
    <li
      className={cn(
        'flex items-center gap-4 rounded-2xl border-2 bg-surface px-4 py-3 font-bold',
        isMe ? 'border-brand bg-brand-soft' : 'border-line',
      )}
    >
      <span className="w-8 text-center font-display text-xl text-ink-soft">{entry.rank}</span>
      <span className="flex-1 truncate">
        {entry.fullName}
        {isMe ? ' (em)' : ''}
      </span>
      <span className="text-sm text-ink-soft">Cấp {entry.level}</span>
      <span className="w-24 text-right text-purple-700">⚡ {entry.xp} XP</span>
    </li>
  )
}
