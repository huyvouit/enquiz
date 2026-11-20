import { useState } from 'react'
import { errorMessage } from '@/shared/api/http'
import { GRADE_LEVELS } from '@/shared/api/types'
import { Button, ErrorBox, Field, Input, Modal, Select } from '@/shared/components'
import { useClassMutations } from '../hooks/useClasses'
import type { ClassDetail } from '../types'

/** Rename, grade, school name; archive / restore. */
export function ClassSettingsModal({ classDetail, onClose }: { classDetail: ClassDetail; onClose: () => void }) {
  const { update } = useClassMutations(classDetail.id)
  const [name, setName] = useState(classDetail.name)
  const [gradeLevel, setGradeLevel] = useState(classDetail.gradeLevel)
  const [schoolName, setSchoolName] = useState(classDetail.schoolName ?? '')
  const archived = classDetail.status === 'archived'

  function save() {
    update.mutate({ name: name.trim(), gradeLevel, schoolName: schoolName.trim() }, { onSuccess: onClose })
  }

  function toggleArchive() {
    const msg = archived
      ? 'Mở lại lớp này? Mã mời sẽ dùng được trở lại.'
      : 'Lưu trữ lớp này? Lớp bị ẩn khỏi danh sách, mã mời ngừng hoạt động; dữ liệu vẫn được giữ.'
    if (!window.confirm(msg)) return
    update.mutate({ status: archived ? 'active' : 'archived' }, { onSuccess: onClose })
  }

  return (
    <Modal open title="⚙️ Cài đặt lớp" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <Field label="Tên lớp">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
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
        <Field label="Tên trường" hint="In trên bảng điểm xuất ra Excel/PDF">
          <Input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} maxLength={100} />
        </Field>
        {update.error ? <ErrorBox message={errorMessage(update.error)} /> : null}
        <div className="flex flex-wrap justify-between gap-2">
          <Button variant={archived ? 'secondary' : 'danger'} onClick={toggleArchive} loading={update.isPending}>
            {archived ? '♻️ Mở lại lớp' : '🗄️ Lưu trữ lớp'}
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Huỷ
            </Button>
            <Button onClick={save} loading={update.isPending} disabled={!name.trim()}>
              Lưu
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
