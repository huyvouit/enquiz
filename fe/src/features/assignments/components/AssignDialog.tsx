import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import type { ClassDetail } from '@/features/classes'
import { errorMessage } from '@/shared/api/http'
import { GRADE_LEVELS } from '@/shared/api/types'
import { Button, ErrorBox, Field, Input, Modal, Select, Spinner, Textarea } from '@/shared/components'
import { cn } from '@/shared/lib/cn'
import { assignmentsApi } from '../api/assignments.api'
import { useCreateAssignment } from '../hooks/useAssignments'
import { useNow } from '../hooks/useNow'
import { defaultDue, formatDue, fromVnInputs } from '../lib/vn-time'
import type { AssignableQuiz, AssignmentTargetKind, AssignmentView } from '../types'
import { DueDateInput } from './StateParts'

export interface AssignDialogProps {
  open: boolean
  onClose: () => void
  /** The class to give the homework to; without it the teacher picks a class first. */
  classDetail?: ClassDetail
  /** Preselected quiz (the quiz step is skipped). The title is fetched when empty. */
  quiz?: { id: string; title: string }
  /** Preselected students: the target starts as "Chọn học sinh". */
  initialStudentIds?: string[]
  onCreated?: (assignment: AssignmentView) => void
}

const NOTE_MAX = 200

/** Give a quiz as homework to a class, a group or hand-picked students (plan 3.2). */
export function AssignDialog(props: AssignDialogProps) {
  // Mounting the form only while open resets every field each time it opens.
  return (
    <Modal open={props.open} title="📬 Giao bài tập" onClose={props.onClose}>
      {props.open ? <AssignForm {...props} /> : null}
    </Modal>
  )
}

function AssignForm({ onClose, classDetail, quiz, initialStudentIds, onCreated }: AssignDialogProps) {
  const [classId, setClassId] = useState(classDetail?.id ?? '')
  const classes = useQuery({
    queryKey: ['assignments', 'picker', 'classes'],
    queryFn: assignmentsApi.myClasses,
    enabled: !classDetail,
  })
  const detailQuery = useQuery({
    queryKey: ['assignments', 'picker', 'class', classId],
    queryFn: () => assignmentsApi.classDetail(classId),
    enabled: !classDetail && !!classId,
  })
  const cls = classDetail ?? detailQuery.data

  const [picked, setPicked] = useState<{ id: string; title: string } | null>(quiz ?? null)
  const quizTitle = useQuery({
    queryKey: ['assignments', 'picker', 'quiz', quiz?.id],
    queryFn: () => assignmentsApi.quizTitle(quiz!.id),
    enabled: !!quiz && !quiz.title,
  })
  const pickedTitle = picked?.title || quizTitle.data?.title || 'Bài đã chọn'

  const [kind, setKind] = useState<AssignmentTargetKind>(initialStudentIds?.length ? 'students' : 'class')
  const [groupId, setGroupId] = useState('')
  const [studentIds, setStudentIds] = useState<string[]>(initialStudentIds ?? [])
  const [due, setDue] = useState(() => defaultDue(7))
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const create = useCreateAssignment()
  const now = useNow()

  const dueDate = fromVnInputs(due.date, due.time)
  const dueError = !dueDate
    ? 'Hãy chọn ngày và giờ'
    : dueDate.getTime() <= now
      ? 'Hạn nộp phải ở sau thời điểm hiện tại'
      : null

  const targetReady =
    kind === 'class' ? (cls?.students.length ?? 0) > 0 : kind === 'group' ? !!groupId : studentIds.length > 0
  const canSubmit = !!cls && !!picked && !dueError && targetReady && !create.isPending

  async function submit() {
    if (!cls || !picked || !dueDate) return
    setFormError(null)
    try {
      const created = await create.mutateAsync({
        classId: cls.id,
        payload: {
          quizId: picked.id,
          target:
            kind === 'group' ? { kind, groupId } : kind === 'students' ? { kind, studentIds } : { kind },
          dueDate: dueDate.toISOString(),
          note: note.trim() || undefined,
        },
      })
      onCreated?.(created)
      onClose()
    } catch (e) {
      setFormError(errorMessage(e))
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 1. Class */}
      {classDetail ? (
        <p className="font-bold">
          Lớp: <span className="text-brand-dark">{classDetail.name}</span>
        </p>
      ) : (
        <Field label="1. Chọn lớp">
          {classes.isLoading ? (
            <Spinner label="Đang tải lớp..." />
          ) : (
            <Select
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value)
                setGroupId('')
                setStudentIds([])
              }}
            >
              <option value="">— Chọn lớp —</option>
              {classes.data
                ?.filter((c) => c.status === 'active')
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (khối {c.gradeLevel}, {c.studentCount} em)
                  </option>
                ))}
            </Select>
          )}
          {classes.data?.length === 0 ? (
            <span className="text-sm text-ink-soft">Bạn chưa có lớp nào. Hãy tạo lớp trước.</span>
          ) : null}
        </Field>
      )}

      {/* 2. Quiz */}
      {picked ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-brand/30 bg-brand-soft/50 p-3">
          <span className="font-bold">Bài: {pickedTitle}</span>
          {!quiz ? (
            <Button size="sm" variant="ghost" onClick={() => setPicked(null)}>
              Đổi bài
            </Button>
          ) : null}
        </div>
      ) : (
        <QuizPicker defaultGrade={cls?.gradeLevel} onPick={(q) => setPicked({ id: q.id, title: q.title })} />
      )}

      {/* 3. Target */}
      {cls ? (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-sm font-bold">Giao cho</legend>
          <div className="flex flex-wrap gap-2">
            <Choice active={kind === 'class'} onClick={() => setKind('class')}>
              👥 Cả lớp ({cls.students.length})
            </Choice>
            <Choice active={kind === 'group'} onClick={() => setKind('group')} disabled={cls.groups.length === 0}>
              🧩 Một nhóm
            </Choice>
            <Choice active={kind === 'students'} onClick={() => setKind('students')}>
              ✋ Chọn học sinh
            </Choice>
          </div>
          {kind === 'group' ? (
            <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="">— Chọn nhóm —</option>
              {cls.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.studentIds.length} em)
                </option>
              ))}
            </Select>
          ) : null}
          {kind === 'students' ? (
            <div className="flex max-h-48 flex-wrap gap-2 overflow-y-auto">
              {cls.students.map((s) => {
                const on = studentIds.includes(s.id)
                return (
                  <Choice
                    key={s.id}
                    active={on}
                    onClick={() =>
                      setStudentIds((ids) => (on ? ids.filter((x) => x !== s.id) : [...ids, s.id]))
                    }
                  >
                    {on ? '✓ ' : ''}
                    {s.fullName}
                  </Choice>
                )
              })}
            </div>
          ) : null}
          {kind === 'class' && cls.students.length === 0 ? (
            <span className="text-sm font-bold text-coral">Lớp chưa có học sinh nào.</span>
          ) : null}
        </fieldset>
      ) : null}

      {/* 4. Due date + note */}
      <div className="flex flex-col gap-1">
        <DueDateInput date={due.date} time={due.time} onChange={setDue} error={dueError} />
        {dueDate && !dueError ? <span className="text-sm text-ink-soft">Hạn: {formatDue(dueDate)}</span> : null}
      </div>
      <Field label="Lời nhắn cho học sinh (không bắt buộc)" hint={`${note.length}/${NOTE_MAX}`}>
        <Textarea
          value={note}
          maxLength={NOTE_MAX}
          placeholder="Ví dụ: Các em làm cẩn thận nhé!"
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>

      {formError ? <ErrorBox message={formError} /> : null}
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>
          Huỷ
        </Button>
        <Button disabled={!canSubmit} loading={create.isPending} onClick={() => void submit()}>
          📬 Giao bài
        </Button>
      </div>
    </div>
  )
}

function QuizPicker({ defaultGrade, onPick }: { defaultGrade?: number; onPick: (q: AssignableQuiz) => void }) {
  const [search, setSearch] = useState('')
  const [grade, setGrade] = useState<number | ''>(defaultGrade ?? '')
  const quizzes = useQuery({
    queryKey: ['assignments', 'picker', 'quizzes', search.trim(), grade],
    queryFn: () =>
      assignmentsApi.searchQuizzes({
        search: search.trim() || undefined,
        gradeLevel: grade === '' ? undefined : grade,
        limit: 20,
      }),
  })
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-bold">2. Chọn bài quiz</span>
      <div className="flex flex-wrap gap-2">
        <Input
          className="min-w-48 flex-1"
          placeholder="🔍 Tìm theo tên bài..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          className="w-auto!"
          value={grade}
          onChange={(e) => setGrade(e.target.value === '' ? '' : Number(e.target.value))}
        >
          <option value="">Mọi khối</option>
          {GRADE_LEVELS.map((g) => (
            <option key={g} value={g}>
              Khối {g}
            </option>
          ))}
        </Select>
      </div>
      <ul className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
        {quizzes.isLoading ? <Spinner label="Đang tìm..." /> : null}
        {quizzes.data?.items.map((q) => (
          <li key={q.id}>
            <button
              type="button"
              onClick={() => onPick(q)}
              className="flex w-full items-center gap-3 rounded-xl border-2 border-line bg-surface px-3 py-2 text-left hover:border-brand"
            >
              <span className="text-2xl" aria-hidden>
                {q.coverEmoji}
              </span>
              <span className="flex-1">
                <span className="block font-bold">{q.title}</span>
                <span className="text-xs text-ink-soft">
                  Khối {q.gradeLevel} · {q.questionCount} câu · {q.author ? q.author.fullName : 'Hệ thống'}
                  {q.status === 'draft' ? ' · Nháp' : ''}
                </span>
              </span>
            </button>
          </li>
        ))}
        {quizzes.data?.items.length === 0 ? (
          <li className="py-3 text-center text-sm text-ink-soft">Không tìm thấy bài nào</li>
        ) : null}
      </ul>
    </div>
  )
}

function Choice({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'min-h-11 rounded-xl border-2 px-3 py-2 text-sm font-bold transition-colors disabled:opacity-40',
        active ? 'border-brand bg-brand-soft text-brand-dark' : 'border-line bg-surface hover:border-brand',
      )}
    >
      {children}
    </button>
  )
}
