import { useState } from 'react'
import { Link } from 'react-router-dom'
import { errorMessage } from '@/shared/api/http'
import { Button, EmptyState, ErrorBox, Modal } from '@/shared/components'
import type { TemporaryPassword } from '../api/classes.api'
import { useClassMutations } from '../hooks/useClasses'
import type { ClassDetail, ClassStudent } from '../types'
import { AddStudentsModal } from './AddStudentsModal'

/** Học sinh tab: roster, add in bulk, reset password, remove from class. */
export function StudentsTab({ classDetail }: { classDetail: ClassDetail }) {
  const { removeStudent, resetPassword } = useClassMutations(classDetail.id)
  const [adding, setAdding] = useState(false)
  const [reset, setReset] = useState<TemporaryPassword | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function remove(s: ClassStudent) {
    if (!window.confirm(`Cho ${s.fullName} rời lớp? Tài khoản và lịch sử làm bài của em vẫn được giữ.`)) return
    setError(null)
    try {
      await removeStudent.mutateAsync(s.id)
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  async function resetFor(s: ClassStudent) {
    if (!window.confirm(`Đặt lại mật khẩu cho ${s.fullName}? Mật khẩu cũ sẽ không dùng được nữa.`)) return
    setError(null)
    try {
      setReset(await resetPassword.mutateAsync(s.id))
    } catch (e) {
      setError(errorMessage(e))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-bold text-ink-soft">{classDetail.studentCount} học sinh</p>
        <Button variant="success" onClick={() => setAdding(true)}>
          ＋ Thêm học sinh
        </Button>
      </div>
      {error ? <ErrorBox message={error} /> : null}

      {classDetail.students.length === 0 ? (
        <EmptyState emoji="👧" title="Lớp chưa có học sinh">
          Đọc mã lớp <b>{classDetail.code}</b> cho các em tự vào lớp, hoặc bấm “Thêm học sinh” để tạo tài khoản cho cả lớp.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-2xl border-2 border-line bg-surface">
          <table className="w-full min-w-[640px] text-left">
            <thead className="bg-brand-soft text-sm text-brand-dark">
              <tr>
                <th className="px-4 py-3">Họ tên</th>
                <th className="px-4 py-3">Tên đăng nhập</th>
                <th className="px-4 py-3">Cấp</th>
                <th className="px-4 py-3">XP</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {classDetail.students.map((s) => (
                <tr key={s.id} className="border-t border-line">
                  <td className="px-4 py-3 font-bold">{s.fullName}</td>
                  <td className="px-4 py-3 font-mono text-sm">{s.username}</td>
                  <td className="px-4 py-3">🏅 {s.level}</td>
                  <td className="px-4 py-3">⚡ {s.xp}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      <Link to={`/teacher/classes/${classDetail.id}/students/${s.id}`}>
                        <Button size="sm" variant="ghost">
                          📈 Xem tiến độ
                        </Button>
                      </Link>
                      <Button size="sm" variant="secondary" onClick={() => void resetFor(s)}>
                        🔑 Đặt lại mật khẩu
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => void remove(s)}>
                        Cho rời lớp
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddStudentsModal open={adding} onClose={() => setAdding(false)} classDetail={classDetail} />
      <Modal open={!!reset} title="🔑 Mật khẩu mới" onClose={() => setReset(null)}>
        {reset ? (
          <div className="flex flex-col gap-4">
            <p className="font-semibold">
              Mật khẩu tạm của <b>{reset.fullName}</b> (tên đăng nhập <span className="font-mono">{reset.username}</span>):
            </p>
            <p className="rounded-2xl bg-sunny-soft py-4 text-center font-mono text-4xl font-extrabold tracking-wider text-yellow-800">
              {reset.temporaryPassword}
            </p>
            <p className="text-sm text-ink-soft">Mật khẩu chỉ hiện một lần. Hãy ghi lại và đưa cho em.</p>
            <div className="flex justify-end">
              <Button onClick={() => setReset(null)}>Đã ghi lại</Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
