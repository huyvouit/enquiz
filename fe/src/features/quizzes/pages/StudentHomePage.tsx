import { useState } from 'react'
import { ReminderBanner } from '@/features/assignments'
import { useAuthStore } from '@/features/auth'
import { JoinClassCard, useMyClasses } from '@/features/classes'
import { useQuestMap } from '@/features/progress'
import { errorMessage } from '@/shared/api/http'
import { GRADE_LEVELS } from '@/shared/api/types'
import { Card, EmptyState, ErrorBox, Mascot, Spinner } from '@/shared/components'
import { cn } from '@/shared/lib/cn'
import { QuestMapNode } from '../components/QuestMapNode'

/**
 * /home — the student's quest map: the stations of one grade along a winding
 * path. A station opens when the one before it is passed; every first pass is
 * a level-up. The server enforces the same locks.
 */
export function StudentHomePage() {
  const user = useAuthStore((s) => s.user)
  const myClasses = useMyClasses()
  const [grade, setGrade] = useState(user?.studentProfile?.gradeLevel ?? 1)
  const map = useQuestMap(grade)
  const [hint, setHint] = useState<string | null>(null)

  const stations = map.data?.stations ?? []
  const passedCount = stations.filter((s) => s.status === 'passed').length
  const next = stations.find((s) => s.status === 'unlocked')
  const allDone = stations.length > 0 && passedCount === stations.length

  const mascotMessage =
    hint ??
    (allDone
      ? `Tuyệt vời! Em đã chinh phục cả bản đồ lớp ${grade}! 🏆`
      : next
        ? `Trạm tiếp theo: ${next.coverEmoji} ${next.title}. Cần ${map.data?.passScore ?? 60} điểm để vượt trạm!`
        : `Chào ${user?.fullName ?? 'em'}! Hôm nay mình học gì nào? 🎈`)

  return (
    <div className="mx-auto max-w-3xl">
      <ReminderBanner />
      {myClasses.data && myClasses.data.length === 0 ? <JoinClassCard /> : null}
      {map.data ? (
        <Card className="mb-6 flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-brand to-grape text-white">
          <div>
            <p className="text-sm font-bold opacity-80">Cấp độ của em</p>
            <p className="font-display text-4xl font-extrabold">🏅 Cấp {map.data.level}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl font-extrabold">⚡ {map.data.xp} XP</p>
            <p className="text-sm font-bold opacity-80">
              Lớp {grade}: {passedCount}/{stations.length} trạm
            </p>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-white/25">
            <div
              className="h-full rounded-full bg-sunny transition-all duration-700"
              style={{ width: `${stations.length ? (passedCount / stations.length) * 100 : 0}%` }}
            />
          </div>
        </Card>
      ) : null}

      <Mascot className="mb-6" mood={hint ? 'thinking' : 'happy'} message={mascotMessage} />

      <div className="mb-8 flex flex-wrap justify-center gap-2" role="tablist" aria-label="Chọn lớp">
        {GRADE_LEVELS.map((g) => (
          <button
            key={g}
            role="tab"
            aria-selected={grade === g}
            onClick={() => {
              setHint(null)
              setGrade(g)
            }}
            className={cn(
              'rounded-2xl border-2 px-4 py-2 font-display text-lg font-bold transition-all',
              grade === g ? 'border-brand bg-brand text-white shadow-pop-sm' : 'border-line bg-surface hover:border-brand',
            )}
          >
            Lớp {g}
          </button>
        ))}
      </div>

      {map.isPending ? <Spinner label="Đang mở bản đồ..." /> : null}
      {map.error ? <ErrorBox message={errorMessage(map.error)} onRetry={() => void map.refetch()} /> : null}
      {map.data && stations.length === 0 ? (
        <EmptyState emoji="🗺️" title={`Lớp ${grade} chưa có trạm nào`}>
          Thầy cô sẽ sớm thêm bài mới nhé!
        </EmptyState>
      ) : null}

      {!map.isPending && stations.length > 0 ? (
        <div className="relative flex flex-col items-center gap-10 py-4">
          <div
            aria-hidden
            className="absolute inset-y-0 left-1/2 -z-10 w-2 -translate-x-1/2 rounded-full bg-[repeating-linear-gradient(to_bottom,#c7d2fe_0_14px,transparent_14px_26px)]"
          />
          {stations.map((s, i) => (
            <QuestMapNode
              key={s.id}
              station={s}
              index={i}
              onLockedTap={() =>
                setHint(`Trạm “${s.title}” đang khoá 🔒. Em vượt qua trạm phía trước để mở nhé!`)
              }
            />
          ))}
          <span className={cn('text-5xl', !allDone && 'opacity-40 grayscale')} aria-hidden>
            🏆
          </span>
        </div>
      ) : null}
    </div>
  )
}
