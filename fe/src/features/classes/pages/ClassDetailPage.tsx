import { useState, type ComponentType } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { errorMessage } from '@/shared/api/http'
import { Badge, Button, ErrorBox, Spinner } from '@/shared/components'
import { cn } from '@/shared/lib/cn'
import { ClassSettingsModal } from '../components/ClassSettingsModal'
import { GroupsTab } from '../components/GroupsTab'
import { StudentsTab } from '../components/StudentsTab'
import { useClassDetail, useClassMutations } from '../hooks/useClasses'
import type { ClassDetail, ClassTabProps } from '../types'

export type ClassTabKey = 'students' | 'groups' | 'assignments' | 'analytics'

export interface ClassDetailPageProps {
  /** Tabs owned by other features, plugged in by the app router. */
  tabs?: {
    assignments?: ComponentType<ClassTabProps>
    analytics?: ComponentType<ClassTabProps>
  }
}

/**
 * /teacher/classes/:classId — one class: invite code, students, groups,
 * plus the Bài tập / Thống kê tabs. The active tab is `?tab=` in the URL.
 */
export function ClassDetailPage({ tabs = {} }: ClassDetailPageProps) {
  const { classId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const detail = useClassDetail(classId)
  const [settings, setSettings] = useState(false)

  const available: { key: ClassTabKey; label: string }[] = [
    { key: 'students', label: '👧 Học sinh' },
    { key: 'groups', label: '👥 Nhóm' },
    ...(tabs.assignments ? [{ key: 'assignments' as const, label: '📬 Bài tập' }] : []),
    ...(tabs.analytics ? [{ key: 'analytics' as const, label: '📊 Thống kê' }] : []),
  ]
  const requested = params.get('tab') as ClassTabKey | null
  const active = available.some((t) => t.key === requested) ? requested! : 'students'

  function selectTab(key: ClassTabKey) {
    // Switching tabs drops one-off params (e.g. assignQuiz) meant for another tab.
    setParams({ tab: key }, { replace: true })
  }

  if (detail.isPending) return <Spinner />
  if (detail.error) return <ErrorBox message={errorMessage(detail.error)} onRetry={() => detail.refetch()} />
  const c = detail.data
  const reload = () => void detail.refetch()
  const Extra = active === 'assignments' ? tabs.assignments : active === 'analytics' ? tabs.analytics : undefined

  return (
    <div>
      <Link to="/teacher/classes" className="mb-3 inline-block font-bold text-brand hover:underline">
        ← Lớp học
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold sm:text-4xl">{c.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 font-semibold text-ink-soft">
            <Badge>Lớp {c.gradeLevel}</Badge>
            {c.status === 'archived' ? <Badge tone="neutral">Đã lưu trữ</Badge> : null}
            {c.schoolName ? <span>{c.schoolName}</span> : null}
            {c.teacher ? <span>· GV {c.teacher.fullName}</span> : null}
          </p>
          <Button className="mt-3" size="sm" variant="secondary" onClick={() => setSettings(true)}>
            ⚙️ Cài đặt lớp
          </Button>
        </div>
        <InviteCode classDetail={c} />
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border-2 border-line bg-surface p-1" role="tablist">
        {available.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={active === t.key}
            onClick={() => selectTab(t.key)}
            className={cn(
              'whitespace-nowrap rounded-xl px-4 py-2 font-bold transition-colors',
              active === t.key ? 'bg-brand text-white' : 'text-ink-soft hover:text-ink',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active === 'students' ? <StudentsTab classDetail={c} /> : null}
      {active === 'groups' ? <GroupsTab classDetail={c} /> : null}
      {Extra ? <Extra classDetail={c} reload={reload} /> : null}

      {settings ? <ClassSettingsModal classDetail={c} onClose={() => setSettings(false)} /> : null}
    </div>
  )
}

/** Big, projector-friendly invite code with copy and regenerate. */
function InviteCode({ classDetail }: { classDetail: ClassDetail }) {
  const { regenerateCode } = useClassMutations(classDetail.id)
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(classDetail.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      window.prompt('Sao chép mã lớp:', classDetail.code)
    }
  }

  function regenerate() {
    if (!window.confirm('Tạo mã mới? Mã cũ sẽ không dùng được nữa (học sinh đã vào lớp không bị ảnh hưởng).')) return
    regenerateCode.mutate()
  }

  return (
    <div className="rounded-blob border-2 border-sunny bg-sunny-soft px-6 py-4 text-center shadow-pop-sm">
      <p className="text-sm font-bold text-yellow-800">Mã vào lớp</p>
      <p className="font-display text-5xl font-extrabold tracking-[0.2em] text-ink sm:text-6xl" aria-live="polite">
        {classDetail.code}
      </p>
      <div className="mt-2 flex justify-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => void copy()}>
          {copied ? '✓ Đã chép' : '📋 Sao chép'}
        </Button>
        <Button size="sm" variant="ghost" onClick={regenerate} loading={regenerateCode.isPending}>
          🔄 Đổi mã
        </Button>
      </div>
      {regenerateCode.error ? <p className="mt-2 text-sm text-coral">{errorMessage(regenerateCode.error)}</p> : null}
    </div>
  )
}
