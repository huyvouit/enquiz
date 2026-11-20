import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage } from '@/shared/api/http'
import { GRADE_LEVELS } from '@/shared/api/types'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBox,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Toggle,
} from '@/shared/components'
import { classesApi } from '../api/classes.api'
import { classKeys, useTeachingClasses } from '../hooks/useClasses'

/** /teacher/classes — the teacher's classes (admin: every class). */
export function ClassesPage() {
  const [archived, setArchived] = useState(false)
  const [creating, setCreating] = useState(false)
  const classes = useTeachingClasses(archived)
  const list = classes.data ?? []

  return (
    <div>
      <PageHeader
        title="🏫 Lớp học"
        subtitle="Học sinh vào lớp bằng mã mời, hoặc cô tạo tài khoản cho cả lớp"
        actions={
          <Button variant="success" onClick={() => setCreating(true)}>
            ＋ Tạo lớp
          </Button>
        }
      />
      <div className="mb-5">
        <Toggle checked={archived} onChange={setArchived} label="Hiện cả lớp đã lưu trữ" />
      </div>

      {classes.isPending ? <Spinner /> : null}
      {classes.error ? <ErrorBox message={errorMessage(classes.error)} onRetry={() => classes.refetch()} /> : null}
      {classes.isSuccess && list.length === 0 ? (
        <EmptyState emoji="🏫" title="Chưa có lớp nào">
          Tạo lớp đầu tiên rồi đọc mã mời cho các em, hoặc thêm học sinh bằng danh sách tên.
        </EmptyState>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((c) => (
          <Link key={c.id} to={`/teacher/classes/${c.id}`} className="block">
            <Card className="h-full transition-transform hover:-translate-y-1">
              <div className="mb-2 flex items-start justify-between gap-2">
                <h2 className="text-xl font-bold">{c.name}</h2>
                {c.status === 'archived' ? <Badge tone="neutral">Lưu trữ</Badge> : <Badge>Lớp {c.gradeLevel}</Badge>}
              </div>
              {c.schoolName ? <p className="text-sm font-semibold text-ink-soft">{c.schoolName}</p> : null}
              <div className="mt-4 flex items-end justify-between gap-2">
                <span className="font-bold text-ink-soft">👧 {c.studentCount} học sinh</span>
                <span className="rounded-xl bg-sunny-soft px-3 py-1 font-display text-lg font-extrabold tracking-widest text-yellow-800">
                  {c.code}
                </span>
              </div>
              {c.teacher ? <p className="mt-2 text-xs text-ink-soft">GV: {c.teacher.fullName}</p> : null}
            </Card>
          </Link>
        ))}
      </div>

      <CreateClassModal open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}

function CreateClassModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [gradeLevel, setGradeLevel] = useState(1)
  const [schoolName, setSchoolName] = useState('')
  const create = useMutation({
    mutationFn: classesApi.create,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: classKeys.all })
      setName('')
      setSchoolName('')
      onClose()
    },
  })

  function submit(e: FormEvent) {
    e.preventDefault()
    create.mutate({ name: name.trim(), gradeLevel, schoolName: schoolName.trim() || undefined })
  }

  return (
    <Modal open={open} title="Tạo lớp mới" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Tên lớp">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lớp 3A – Tiếng Anh" maxLength={60} required autoFocus />
        </Field>
        <Field label="Khối">
          <Select value={gradeLevel} onChange={(e) => setGradeLevel(Number(e.target.value))}>
            {GRADE_LEVELS.map((g) => (
              <option key={g} value={g}>
                Lớp {g}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tên trường (không bắt buộc)" hint="In trên bảng điểm xuất ra Excel/PDF">
          <Input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} maxLength={100} />
        </Field>
        {create.error ? <ErrorBox message={errorMessage(create.error)} /> : null}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" variant="success" loading={create.isPending} disabled={!name.trim()}>
            Tạo lớp
          </Button>
        </div>
      </form>
    </Modal>
  )
}
