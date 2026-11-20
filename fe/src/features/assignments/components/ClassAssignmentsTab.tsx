import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { ClassTabProps } from '@/features/classes'
import { errorMessage } from '@/shared/api/http'
import { Badge, Button, EmptyState, ErrorBox, Modal, Spinner } from '@/shared/components'
import {
  useClassAssignments,
  useDeleteAssignment,
  useUpdateAssignment,
} from '../hooks/useAssignments'
import { useNow } from '../hooks/useNow'
import { targetLabel } from '../lib/states'
import { countdown, formatDue, fromVnInputs, toVnInputs } from '../lib/vn-time'
import type { AssignmentView } from '../types'
import { AssignDialog } from './AssignDialog'
import { CountsBar, DueDateInput } from './StateParts'

/**
 * "Bài tập" tab of the class page. Also opens the assign dialog prefilled
 * from the URL: ?tab=assignments&assignQuiz=<quizId>&assignStudents=<id,id>
 * (used by the analytics heatmap "Giao bài ôn").
 */
export function ClassAssignmentsTab({ classDetail }: ClassTabProps) {
  const list = useClassAssignments(classDetail.id)
  const [params, setParams] = useSearchParams()
  const [dialog, setDialog] = useState<{ quizId?: string; studentIds?: string[] } | null>(null)
  const [extending, setExtending] = useState<AssignmentView | null>(null)

  // A request handed over in the URL (analytics "Giao bài ôn") opens the
  // dialog prefilled; the params are removed when the dialog closes.
  const urlQuiz = params.get('assignQuiz')
  const urlStudents = params.get('assignStudents')
  const members = new Set(classDetail.students.map((s) => s.id))
  const fromUrl =
    urlQuiz || urlStudents
      ? {
          quizId: urlQuiz ?? undefined,
          studentIds: urlStudents?.split(',').filter((id) => members.has(id)),
        }
      : null
  const request = dialog ?? fromUrl

  function closeDialog() {
    setDialog(null)
    if (fromUrl) {
      const next = new URLSearchParams(params)
      next.delete('assignQuiz')
      next.delete('assignStudents')
      setParams(next, { replace: true })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-soft">
          Bài đã giao cho lớp. Trạng thái nộp bài được tính tự động theo hạn nộp.
        </p>
        <Button onClick={() => setDialog({})}>📬 Giao bài</Button>
      </div>

      {list.isLoading ? <Spinner /> : null}
      {list.error ? <ErrorBox message={errorMessage(list.error)} onRetry={() => void list.refetch()} /> : null}
      {list.data?.length === 0 ? (
        <EmptyState emoji="📬" title="Lớp chưa có bài tập nào">
          Bấm <b>Giao bài</b> để chọn một quiz và đặt hạn nộp.
        </EmptyState>
      ) : null}

      <ul className="flex flex-col gap-3">
        {list.data?.map((a) => (
          <AssignmentRow key={a.id} assignment={a} onExtend={() => setExtending(a)} />
        ))}
      </ul>

      <AssignDialog
        open={request !== null}
        onClose={closeDialog}
        classDetail={classDetail}
        quiz={request?.quizId ? { id: request.quizId, title: '' } : undefined}
        initialStudentIds={request?.studentIds}
      />
      <ExtendDialog assignment={extending} onClose={() => setExtending(null)} />
    </div>
  )
}

function AssignmentRow({ assignment: a, onExtend }: { assignment: AssignmentView; onExtend: () => void }) {
  const update = useUpdateAssignment()
  const remove = useDeleteAssignment()
  const now = useNow()
  const closed = a.status === 'closed'
  const overdue = new Date(a.dueDate).getTime() < now
  const busy = update.isPending || remove.isPending

  return (
    <li className="flex flex-col gap-3 rounded-2xl border-2 border-line bg-surface p-4 shadow-pop-sm sm:flex-row sm:items-center">
      <span className="text-4xl" aria-hidden>
        {a.quiz?.coverEmoji ?? '🗑️'}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-lg font-bold">{a.quiz?.title ?? '(Quiz đã bị xoá)'}</span>
          <Badge tone="grape">{targetLabel(a.target, a.counts.assigned)}</Badge>
          {closed ? <Badge tone="neutral">🔒 Đã đóng</Badge> : null}
        </div>
        <div className="text-sm text-ink-soft">
          Hạn {formatDue(a.dueDate)} ·{' '}
          <span className={overdue ? 'font-bold text-coral' : 'font-bold text-brand-dark'}>
            {countdown(a.dueDate, new Date(now))}
          </span>
          {a.averageScore !== null ? <> · Điểm TB {a.averageScore}</> : null}
        </div>
        {a.note ? <div className="text-sm italic text-ink-soft">“{a.note}”</div> : null}
        <CountsBar counts={a.counts} />
        {update.error || remove.error ? (
          <span className="text-sm font-bold text-coral">{errorMessage(update.error ?? remove.error)}</span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch">
        <Link
          to={`/teacher/assignments/${a.id}`}
          className="rounded-xl bg-brand px-3 py-1.5 text-center text-sm font-bold text-white shadow-pop-sm hover:bg-brand-dark"
        >
          📊 Xem kết quả
        </Link>
        <Button size="sm" variant="secondary" disabled={busy} onClick={onExtend}>
          ⏰ Gia hạn
        </Button>
        <Button
          size="sm"
          variant="secondary"
          loading={update.isPending}
          disabled={busy}
          onClick={() => update.mutate({ id: a.id, payload: { status: closed ? 'active' : 'closed' } })}
        >
          {closed ? '🔓 Mở lại' : '🔒 Đóng'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-coral"
          loading={remove.isPending}
          disabled={busy}
          onClick={() => {
            if (window.confirm('Xoá bài tập này? Bài làm của học sinh vẫn được giữ trong lịch sử.')) {
              remove.mutate(a.id)
            }
          }}
        >
          🗑️ Xoá
        </Button>
      </div>
    </li>
  )
}

function ExtendDialog({ assignment, onClose }: { assignment: AssignmentView | null; onClose: () => void }) {
  return (
    <Modal open={assignment !== null} title="⏰ Gia hạn bài tập" onClose={onClose}>
      {assignment ? <ExtendForm assignment={assignment} onClose={onClose} /> : null}
    </Modal>
  )
}

function ExtendForm({ assignment, onClose }: { assignment: AssignmentView; onClose: () => void }) {
  const update = useUpdateAssignment()
  const now = useNow()
  // Start from the current due date, or tomorrow 20:00 if it has passed.
  const [due, setDue] = useState(() => {
    const current = new Date(assignment.dueDate)
    return current.getTime() > Date.now()
      ? toVnInputs(current)
      : { date: toVnInputs(new Date(Date.now() + 86_400_000)).date, time: '20:00' }
  })
  const dueDate = fromVnInputs(due.date, due.time)
  const dueError = !dueDate
    ? 'Hãy chọn ngày và giờ'
    : dueDate.getTime() <= now
      ? 'Hạn nộp phải ở sau thời điểm hiện tại'
      : null

  return (
    <div className="flex flex-col gap-4">
      <p>
        <b>{assignment.quiz?.title ?? 'Bài tập'}</b> — hạn hiện tại: {formatDue(assignment.dueDate)}
      </p>
      <DueDateInput date={due.date} time={due.time} onChange={setDue} error={dueError} />
      <p className="text-sm text-ink-soft">
        Đổi hạn sẽ tự tính lại trạng thái: bài nộp trước hạn mới được tính là đúng hạn.
      </p>
      {update.error ? <ErrorBox message={errorMessage(update.error)} /> : null}
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>
          Huỷ
        </Button>
        <Button
          disabled={!!dueError}
          loading={update.isPending}
          onClick={() =>
            dueDate &&
            update.mutate(
              { id: assignment.id, payload: { dueDate: dueDate.toISOString() } },
              { onSuccess: onClose },
            )
          }
        >
          Lưu hạn mới
        </Button>
      </div>
    </div>
  )
}
