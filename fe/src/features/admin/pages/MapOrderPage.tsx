import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Reorder } from 'framer-motion'
import { useState } from 'react'
import { errorMessage } from '@/shared/api/http'
import { GRADE_LEVELS } from '@/shared/api/types'
import { Badge, Button, Card, EmptyState, ErrorBox, PageHeader, Spinner } from '@/shared/components'
import { cn } from '@/shared/lib/cn'
import { adminApi, adminKeys } from '../api/admin.api'
import type { MapStation } from '../types'

/**
 * Admin: order of the quest-map stations of each grade (plan 3.5).
 * The order is the list of system quizzes; only published ones reach students.
 */
export function MapOrderPage() {
  const queryClient = useQueryClient()
  const [grade, setGrade] = useState(1)
  /** Unsaved order of the current grade (null = as stored). */
  const [draft, setDraft] = useState<string[] | null>(null)
  const [saved, setSaved] = useState(false)

  const stations = useQuery({
    queryKey: adminKeys.mapOrder(grade),
    queryFn: () => adminApi.mapOrder(grade),
  })
  const save = useMutation({
    mutationFn: (ids: string[]) => adminApi.saveMapOrder(grade, ids),
    onSuccess: (result) => {
      queryClient.setQueryData(adminKeys.mapOrder(grade), result)
      setDraft(null)
      setSaved(true)
    },
  })

  const byId = new Map((stations.data ?? []).map((s) => [s.id, s]))
  const order = draft ?? (stations.data ?? []).map((s) => s.id)
  const dirty = draft !== null

  function changeGrade(g: number) {
    setGrade(g)
    setDraft(null)
    setSaved(false)
    save.reset()
  }
  function reorder(ids: string[]) {
    setDraft(ids)
    setSaved(false)
  }
  function move(index: number, delta: -1 | 1) {
    const target = index + delta
    if (target < 0 || target >= order.length) return
    const next = [...order]
    ;[next[index], next[target]] = [next[target], next[index]]
    reorder(next)
  }

  // Station numbers as students see them: drafts are skipped.
  const positions = new Map<string, number>()
  for (const id of order) {
    if (byId.get(id)?.status === 'published') positions.set(id, positions.size + 1)
  }

  return (
    <div>
      <PageHeader
        title="🗺️ Thứ tự trạm trên bản đồ"
        subtitle="Kéo thả hoặc dùng ↑ ↓ để sắp xếp, rồi bấm Lưu"
        actions={
          <Button
            variant="success"
            disabled={!dirty}
            loading={save.isPending}
            onClick={() => save.mutate(order)}
          >
            💾 Lưu thứ tự
          </Button>
        }
      />

      <Card className="mb-5 bg-sky-soft/60 text-sm font-semibold text-ink-soft">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Bản đồ của học sinh chỉ gồm <b className="text-ink">quiz hệ thống đã xuất bản</b> của khối, theo
            thứ tự dưới đây. Trạm sau mở khi em vượt trạm trước.
          </li>
          <li>Quiz do quản trị viên tạo là quiz hệ thống; quiz mới được thêm vào cuối bản đồ.</li>
          <li>
            Quiz của giáo viên không nằm trên bản đồ: các em nhận chúng dưới dạng <b className="text-ink">bài tập</b>{' '}
            của lớp (bài tập không bao giờ bị khoá).
          </li>
        </ul>
      </Card>

      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Khối lớp">
        {GRADE_LEVELS.map((g) => (
          <button
            key={g}
            type="button"
            role="tab"
            aria-selected={grade === g}
            onClick={() => changeGrade(g)}
            className={cn(
              'rounded-xl px-4 py-2 font-bold transition-colors',
              grade === g ? 'bg-brand text-white' : 'bg-surface text-ink-soft hover:text-ink',
            )}
          >
            Lớp {g}
          </button>
        ))}
      </div>

      {saved ? (
        <p role="status" className="mb-4 rounded-2xl bg-grass-soft px-4 py-3 font-bold text-green-700">
          ✅ Đã lưu thứ tự trạm lớp {grade}
        </p>
      ) : null}
      {save.isError ? (
        <div className="mb-4">
          <ErrorBox message={errorMessage(save.error)} />
        </div>
      ) : null}

      {stations.isPending ? (
        <Spinner />
      ) : stations.isError ? (
        <ErrorBox message={errorMessage(stations.error)} onRetry={() => stations.refetch()} />
      ) : order.length === 0 ? (
        <EmptyState emoji="🧭" title={`Lớp ${grade} chưa có quiz hệ thống nào`}>
          Quản trị viên tạo quiz (hoặc chạy <code>npm run seed:content</code>) để thêm trạm.
        </EmptyState>
      ) : (
        <Reorder.Group axis="y" values={order} onReorder={reorder} className="flex flex-col gap-3">
          {order.map((id, index) => {
            const s = byId.get(id)
            if (!s) return null
            return (
              <StationRow
                key={id}
                station={s}
                position={positions.get(id) ?? null}
                first={index === 0}
                last={index === order.length - 1}
                onUp={() => move(index, -1)}
                onDown={() => move(index, 1)}
              />
            )
          })}
        </Reorder.Group>
      )}
    </div>
  )
}

function StationRow({
  station,
  position,
  first,
  last,
  onUp,
  onDown,
}: {
  station: MapStation
  /** Station number students see (null: draft, not on the map). */
  position: number | null
  first: boolean
  last: boolean
  onUp: () => void
  onDown: () => void
}) {
  return (
    <Reorder.Item
      value={station.id}
      className={cn(
        'flex cursor-grab items-center gap-4 rounded-2xl border-2 border-line bg-surface p-3 shadow-pop-sm active:cursor-grabbing',
        position === null && 'opacity-70',
      )}
    >
      <span className="w-10 text-center font-display text-2xl font-extrabold text-brand" aria-label="Số trạm">
        {position ?? '–'}
      </span>
      <span className="text-4xl" aria-hidden>
        {station.coverEmoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{station.title}</p>
        <p className="text-sm text-ink-soft">
          {station.topic} · {station.questionCount} câu
        </p>
      </div>
      {position === null ? <Badge tone="neutral">Nháp</Badge> : <Badge tone="grass">Xuất bản</Badge>}
      <div className="flex flex-col gap-1">
        <Button size="sm" variant="secondary" disabled={first} onClick={onUp} aria-label="Lên trên">
          ↑
        </Button>
        <Button size="sm" variant="secondary" disabled={last} onClick={onDown} aria-label="Xuống dưới">
          ↓
        </Button>
      </div>
    </Reorder.Item>
  )
}
