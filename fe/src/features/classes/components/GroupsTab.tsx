import { useState } from 'react'
import { errorMessage } from '@/shared/api/http'
import { Button, Card, EmptyState, ErrorBox, Field, Input, Modal } from '@/shared/components'
import { cn } from '@/shared/lib/cn'
import { useClassMutations } from '../hooks/useClasses'
import type { ClassDetail, GroupView } from '../types'

const MAX_GROUPS = 10

/** Nhóm tab: named subsets of the class used to give homework to some students. */
export function GroupsTab({ classDetail }: { classDetail: ClassDetail }) {
  const { deleteGroup } = useClassMutations(classDetail.id)
  const [editing, setEditing] = useState<GroupView | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const nameOf = new Map(classDetail.students.map((s) => [s.id, s.fullName]))

  async function remove(g: GroupView) {
    if (!window.confirm(`Xoá nhóm "${g.name}"? Bài tập đã giao cho nhóm vẫn giữ nguyên.`)) return
    setError(null)
    try {
      await deleteGroup.mutateAsync(g.id)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-bold text-ink-soft">Nhóm giúp cô giao bài cho một vài em (ví dụ “Nhóm cần kèm”).</p>
        <Button variant="success" onClick={() => setEditing('new')} disabled={classDetail.groups.length >= MAX_GROUPS}>
          ＋ Tạo nhóm
        </Button>
      </div>
      {error ? <ErrorBox message={error} /> : null}
      {classDetail.groups.length === 0 ? (
        <EmptyState emoji="👥" title="Chưa có nhóm nào" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {classDetail.groups.map((g) => (
            <Card key={g.id}>
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="text-lg font-bold">{g.name}</h3>
                <span className="text-sm font-bold text-ink-soft">{g.studentIds.length} em</span>
              </div>
              <p className="mb-3 text-sm text-ink-soft">
                {g.studentIds.length === 0 ? 'Chưa có thành viên' : g.studentIds.map((id) => nameOf.get(id) ?? '?').join(', ')}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setEditing(g)}>
                  ✏️ Sửa
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void remove(g)}>
                  Xoá
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      {editing ? (
        <GroupEditor
          key={editing === 'new' ? 'new' : editing.id}
          classDetail={classDetail}
          group={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  )
}

function GroupEditor({
  classDetail,
  group,
  onClose,
}: {
  classDetail: ClassDetail
  group: GroupView | null
  onClose: () => void
}) {
  const { saveGroup } = useClassMutations(classDetail.id)
  const [name, setName] = useState(group?.name ?? '')
  const [picked, setPicked] = useState<Set<string>>(new Set(group?.studentIds ?? []))

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function save() {
    saveGroup.mutate(
      { groupId: group?.id ?? null, payload: { name: name.trim(), studentIds: [...picked] } },
      { onSuccess: onClose },
    )
  }

  return (
    <Modal open title={group ? 'Sửa nhóm' : 'Tạo nhóm'} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Field label="Tên nhóm">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Nhóm cần kèm" autoFocus />
        </Field>
        <div>
          <p className="mb-2 text-sm font-bold">Chạm để chọn học sinh ({picked.size})</p>
          <div className="flex max-h-72 flex-wrap gap-2 overflow-y-auto">
            {classDetail.students.map((s) => {
              const on = picked.has(s.id)
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(s.id)}
                  className={cn(
                    'min-h-11 rounded-full border-2 px-4 py-2 font-bold transition-colors',
                    on ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-ink hover:border-brand',
                  )}
                >
                  {on ? '✓ ' : ''}
                  {s.fullName}
                </button>
              )
            })}
          </div>
          {classDetail.students.length === 0 ? <p className="text-sm text-ink-soft">Lớp chưa có học sinh.</p> : null}
        </div>
        {saveGroup.error ? <ErrorBox message={errorMessage(saveGroup.error)} /> : null}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Huỷ
          </Button>
          <Button variant="success" loading={saveGroup.isPending} disabled={!name.trim()} onClick={save}>
            Lưu nhóm
          </Button>
        </div>
      </div>
    </Modal>
  )
}
