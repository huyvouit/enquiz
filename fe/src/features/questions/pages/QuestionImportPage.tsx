import { useRef, useState, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/features/auth'
import { errorMessage } from '@/shared/api/http'
import { Badge, Button, Card, ErrorBox, PageHeader, Spinner } from '@/shared/components'
import { cn } from '@/shared/lib/cn'
import { playSfx } from '@/shared/sound'
import { questionsApi } from '../api/questions.api'
import { QUESTION_TYPE_LABELS, type ImportReport } from '../types'

const MAX_FILE_BYTES = 2 * 1024 * 1024

type Step =
  | { kind: 'pick' }
  | { kind: 'checking'; fileName: string }
  | { kind: 'review'; fileName: string; csv: string; report: ImportReport }
  | { kind: 'importing'; fileName: string; report: ImportReport }
  | { kind: 'done'; report: ImportReport }

function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Không đọc được file'))
    reader.readAsText(file, 'utf-8')
  })
}

/**
 * /teacher/questions/import — upload a CSV, see a dry run (errors per line,
 * duplicates, preview), then import only the valid rows.
 */
export function QuestionImportPage() {
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin')
  const [step, setStep] = useState<Step>({ kind: 'pick' })
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function check(file: File) {
    setError(null)
    if (!/\.csv$/i.test(file.name)) {
      setError('Hãy chọn file .csv (trong Excel: Lưu thành → “CSV UTF-8 (Comma delimited)”).')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('File quá lớn (tối đa 2 MB, 500 câu mỗi lần).')
      return
    }
    setStep({ kind: 'checking', fileName: file.name })
    try {
      const csv = await readText(file)
      const report = await questionsApi.importCsv(csv, true)
      setStep({ kind: 'review', fileName: file.name, csv, report })
    } catch (err) {
      setError(errorMessage(err))
      setStep({ kind: 'pick' })
    }
  }

  async function confirm() {
    if (step.kind !== 'review') return
    setError(null)
    setStep({ kind: 'importing', fileName: step.fileName, report: step.report })
    try {
      const report = await questionsApi.importCsv(step.csv, false)
      playSfx('finish')
      setStep({ kind: 'done', report })
    } catch (err) {
      setError(errorMessage(err))
      setStep(step)
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) void check(file)
  }

  const toImport = (r: ImportReport) => r.created + r.updated

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="📥 Nhập câu hỏi từ CSV"
        subtitle="Mỗi dòng là một câu hỏi; kiểm tra như khi soạn bằng tay, chỉ dòng hợp lệ mới được nhập"
        actions={
          <>
            <Button variant="secondary" onClick={() => void questionsApi.downloadTemplate().catch((e) => setError(errorMessage(e)))}>
              ⬇️ Tải file mẫu
            </Button>
            <Link to="/teacher/questions">
              <Button variant="ghost">← Kho câu hỏi</Button>
            </Link>
          </>
        }
      />

      {isAdmin ? (
        <p className="mb-4 rounded-xl bg-grass-soft px-4 py-2 text-sm font-bold text-green-900">
          🛡️ Bạn là quản trị viên: câu hỏi nhập vào thuộc <b>kho hệ thống</b>. Dòng có cột externalId đã tồn tại sẽ được cập nhật.
        </p>
      ) : null}

      {error ? (
        <div className="mb-4">
          <ErrorBox message={error} />
        </div>
      ) : null}

      {step.kind === 'pick' ? (
        <Card>
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              'flex flex-col items-center gap-3 rounded-2xl border-4 border-dashed p-10 text-center transition-colors',
              dragging ? 'border-brand bg-brand-soft' : 'border-line',
            )}
          >
            <span aria-hidden className="text-5xl">
              📄
            </span>
            <p className="font-bold">Kéo thả file CSV vào đây</p>
            <Button onClick={() => fileRef.current?.click()}>Chọn file…</Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) void check(file)
              }}
            />
          </div>
          <ul className="mt-5 list-disc space-y-1 pl-6 text-sm text-ink-soft">
            <li>
              Soạn trong Excel rồi chọn <b>Lưu thành → “CSV UTF-8 (Comma delimited)”</b> để giữ đúng tiếng Việt và emoji.
            </li>
            <li>
              Cột bắt buộc: <code>type, topic, gradeLevel, questionText</code>. Danh sách trong một ô ngăn bằng <code>|</code>{' '}
              (VD: <code>Dog|Cat|Duck</code>); cặp nối viết <code>🐶=dog</code>.
            </li>
            <li>Tối đa 500 câu mỗi lần. Câu trùng (cùng khối, dạng, nội dung, đáp án) sẽ được bỏ qua.</li>
          </ul>
        </Card>
      ) : null}

      {step.kind === 'checking' ? <Spinner label={`Đang kiểm tra ${step.fileName}…`} /> : null}

      {step.kind === 'review' || step.kind === 'importing' ? (
        <div className="flex flex-col gap-5">
          <Summary report={step.report} fileName={step.fileName} />
          {step.report.errors.length > 0 ? <ErrorsTable report={step.report} /> : null}
          {step.report.skipped.length > 0 ? (
            <Card>
              <h2 className="mb-2 font-display text-xl font-bold">⏭️ Bỏ qua ({step.report.skipped.length})</h2>
              <ul className="space-y-1 text-sm">
                {step.report.skipped.map((s) => (
                  <li key={s.line}>
                    <b>Dòng {s.line}:</b> {s.reason}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
          {step.report.preview.length > 0 ? <PreviewTable report={step.report} /> : null}

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" disabled={step.kind === 'importing'} onClick={() => setStep({ kind: 'pick' })}>
              Chọn file khác
            </Button>
            <Button
              variant="success"
              size="lg"
              loading={step.kind === 'importing'}
              disabled={toImport(step.report) === 0}
              onClick={() => void confirm()}
            >
              Nhập {toImport(step.report)} câu hợp lệ
            </Button>
          </div>
        </div>
      ) : null}

      {step.kind === 'done' ? (
        <Card className="text-center">
          <p className="text-5xl" aria-hidden>
            🎉
          </p>
          <h2 className="mt-2 font-display text-2xl font-extrabold">Đã nhập xong!</h2>
          <p className="mt-1 font-semibold">
            {step.report.created} câu mới
            {step.report.updated ? `, ${step.report.updated} câu cập nhật` : ''}
            {step.report.skipped.length ? `, ${step.report.skipped.length} câu bỏ qua` : ''}.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="secondary" onClick={() => setStep({ kind: 'pick' })}>
              Nhập file khác
            </Button>
            <Link to="/teacher/questions">
              <Button>Về kho câu hỏi</Button>
            </Link>
          </div>
        </Card>
      ) : null}
    </div>
  )
}

function Summary({ report, fileName }: { report: ImportReport; fileName: string }) {
  const tiles = [
    { label: 'Tổng số dòng', value: report.total, cls: 'bg-slate-100' },
    { label: 'Sẽ tạo mới', value: report.created, cls: 'bg-grass-soft text-green-900' },
    ...(report.updated ? [{ label: 'Sẽ cập nhật', value: report.updated, cls: 'bg-sky-soft' }] : []),
    { label: 'Bỏ qua', value: report.skipped.length, cls: 'bg-sunny-soft text-yellow-900' },
    { label: 'Lỗi', value: report.errors.length, cls: 'bg-coral-soft text-rose-900' },
  ]
  return (
    <Card>
      <p className="mb-3 font-bold">📄 {fileName}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiles.map((t) => (
          <div key={t.label} className={cn('rounded-2xl p-3 text-center', t.cls)}>
            <p className="font-display text-3xl font-extrabold">{t.value}</p>
            <p className="text-xs font-bold">{t.label}</p>
          </div>
        ))}
      </div>
      {report.errors.length > 0 ? (
        <p className="mt-3 text-sm font-semibold text-ink-soft">
          Dòng lỗi sẽ không được nhập. Sửa trong file rồi chọn lại, hoặc nhập trước các dòng hợp lệ.
        </p>
      ) : null}
    </Card>
  )
}

function ErrorsTable({ report }: { report: ImportReport }) {
  return (
    <Card className="border-coral/50">
      <h2 className="mb-2 font-display text-xl font-bold text-rose-800">❌ Dòng lỗi ({report.errors.length})</h2>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b-2 border-line">
            <th className="w-20 py-1">Dòng</th>
            <th className="py-1">Lỗi</th>
          </tr>
        </thead>
        <tbody>
          {report.errors.map((e) => (
            <tr key={e.line} className="border-b border-line bg-coral-soft/50 align-top">
              <td className="py-1.5 font-bold">{e.line}</td>
              <td className="py-1.5">{e.messages.join('; ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

function PreviewTable({ report }: { report: ImportReport }) {
  const more = report.created + report.updated - report.preview.length
  return (
    <Card>
      <h2 className="mb-2 font-display text-xl font-bold">✅ Câu hợp lệ</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead>
            <tr className="border-b-2 border-line">
              <th className="w-16 py-1">Dòng</th>
              <th className="py-1">Dạng</th>
              <th className="py-1">Chủ đề</th>
              <th className="py-1">Lớp</th>
              <th className="py-1">Nội dung</th>
            </tr>
          </thead>
          <tbody>
            {report.preview.map((p) => (
              <tr key={p.line} className="border-b border-line">
                <td className="py-1.5 font-bold">{p.line}</td>
                <td className="py-1.5">
                  <Badge tone="sky">{QUESTION_TYPE_LABELS[p.type]}</Badge>
                </td>
                <td className="py-1.5">{p.topic}</td>
                <td className="py-1.5">{p.gradeLevel}</td>
                <td className="py-1.5">{p.questionText}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {more > 0 ? <p className="mt-2 text-sm text-ink-soft">… và {more} câu nữa.</p> : null}
    </Card>
  )
}
