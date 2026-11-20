import { useState } from 'react'
import { errorMessage } from '@/shared/api/http'
import { Button, ErrorBox, Field, Modal, Textarea } from '@/shared/components'
import { useClassMutations } from '../hooks/useClasses'
import type { ClassDetail, CreatedStudent } from '../types'
import { CLASS_MAX_STUDENTS, parseNames } from '../lib/roster'
import { LoginCardsPrint } from './LoginCardsPrint'

/**
 * Bulk account creation: paste names -> preview -> create -> login cards.
 * Passwords exist only in this response, so the result stays on screen
 * until the teacher closes it (and can print it).
 */
export function AddStudentsModal({
  open,
  onClose,
  classDetail,
}: {
  open: boolean
  onClose: () => void
  classDetail: ClassDetail
}) {
  const { bulkCreate } = useClassMutations(classDetail.id)
  const [text, setText] = useState('')
  const [created, setCreated] = useState<CreatedStudent[] | null>(null)
  const names = parseNames(text)
  const room = CLASS_MAX_STUDENTS - classDetail.studentCount
  const tooMany = names.length > room

  function close() {
    if (created && !window.confirm('Mật khẩu sẽ không hiện lại nữa. Cô đã in hoặc ghi lại chưa?')) return
    setText('')
    setCreated(null)
    bulkCreate.reset()
    onClose()
  }

  return (
    <Modal open={open} title={created ? '✅ Đã tạo tài khoản' : 'Thêm học sinh vào lớp'} onClose={close}>
      {created ? (
        <div className="flex flex-col gap-4">
          <p className="rounded-xl bg-sunny-soft p-3 text-sm font-bold text-yellow-800">
            ⚠️ Mật khẩu chỉ hiện <u>một lần</u> ở đây. Hãy in thẻ đăng nhập hoặc ghi lại trước khi đóng.
          </p>
          <div className="max-h-80 overflow-y-auto rounded-xl border-2 border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-brand-soft text-brand-dark">
                <tr>
                  <th className="px-3 py-2">Họ tên</th>
                  <th className="px-3 py-2">Tên đăng nhập</th>
                  <th className="px-3 py-2">Mật khẩu</th>
                </tr>
              </thead>
              <tbody>
                {created.map((s) => (
                  <tr key={s.id} className="border-t border-line">
                    <td className="px-3 py-2 font-bold">{s.fullName}</td>
                    <td className="px-3 py-2 font-mono">{s.username}</td>
                    <td className="px-3 py-2 font-mono">{s.password}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={close}>
              Đóng
            </Button>
            <Button onClick={() => window.print()}>🖨️ In thẻ đăng nhập</Button>
          </div>
          <LoginCardsPrint className={classDetail.name} students={created} />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Field
            label="Họ tên học sinh (mỗi dòng một em)"
            hint={`Hệ thống tự tạo tên đăng nhập và mật khẩu dễ nhớ. Lớp còn chỗ cho ${room} em.`}
          >
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder={'Nguyễn Minh Anh\nTrần Bảo Ngọc\nLê Gia Huy'}
              autoFocus
            />
          </Field>
          {names.length > 0 ? (
            <div>
              <p className="mb-2 text-sm font-bold text-ink-soft">Sẽ tạo {names.length} tài khoản:</p>
              <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
                {names.map((n, i) => (
                  <span key={`${n}-${i}`} className="rounded-full bg-brand-soft px-3 py-1 text-sm font-bold text-brand-dark">
                    {n}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {tooMany ? <ErrorBox message={`Lớp chỉ còn chỗ cho ${room} em (tối đa ${CLASS_MAX_STUDENTS})`} /> : null}
          {bulkCreate.error ? <ErrorBox message={errorMessage(bulkCreate.error)} /> : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>
              Huỷ
            </Button>
            <Button
              variant="success"
              loading={bulkCreate.isPending}
              disabled={names.length === 0 || tooMany}
              onClick={() => bulkCreate.mutate(names, { onSuccess: (r) => setCreated(r.created) })}
            >
              Tạo {names.length > 0 ? names.length : ''} tài khoản
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
