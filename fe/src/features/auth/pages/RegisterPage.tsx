import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { errorMessage } from '@/shared/api/http'
import { GRADE_LEVELS } from '@/shared/api/types'
import { Button, ErrorBox, Field, Input, Select } from '@/shared/components'
import { cn } from '@/shared/lib/cn'
import { AuthCard } from '../components/AuthCard'
import { homePathFor, useAuthStore } from '../store/auth.store'
import type { RegisterPayload } from '../types'

const ROLE_OPTIONS: { value: RegisterPayload['role']; label: string; emoji: string }[] = [
  { value: 'student', label: 'Học sinh', emoji: '🧒' },
  { value: 'teacher', label: 'Giáo viên', emoji: '👩‍🏫' },
]

export function RegisterPage() {
  const register = useAuthStore((s) => s.register)
  const navigate = useNavigate()
  const [form, setForm] = useState<RegisterPayload>({
    username: '',
    password: '',
    fullName: '',
    role: 'student',
    gradeLevel: 1,
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const update = <K extends keyof RegisterPayload>(key: K, value: RegisterPayload[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const payload: RegisterPayload =
        form.role === 'student' ? form : { ...form, gradeLevel: undefined }
      const user = await register(payload)
      navigate(homePathFor(user), { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard title="Tạo tài khoản" mascotSays="Em là học sinh hay giáo viên nhỉ? 🤗">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Vai trò">
          {ROLE_OPTIONS.map((r) => (
            <button
              key={r.value}
              type="button"
              role="radio"
              aria-checked={form.role === r.value}
              onClick={() => update('role', r.value)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-2xl border-2 p-3 font-bold transition-all',
                form.role === r.value
                  ? 'border-brand bg-brand-soft text-brand-dark shadow-pop-sm'
                  : 'border-line bg-surface hover:border-brand/50',
              )}
            >
              <span className="text-3xl" aria-hidden>
                {r.emoji}
              </span>
              {r.label}
            </button>
          ))}
        </div>

        <Field label="Họ và tên">
          <Input value={form.fullName} onChange={(e) => update('fullName', e.target.value)} required maxLength={60} />
        </Field>
        <Field label="Tên đăng nhập" hint="3–30 ký tự: chữ, số, dấu _ hoặc dấu .">
          <Input
            autoComplete="username"
            value={form.username}
            onChange={(e) => update('username', e.target.value)}
            required
            minLength={3}
            maxLength={30}
            pattern="[a-zA-Z0-9_.]+"
          />
        </Field>
        <Field label="Mật khẩu" hint="Ít nhất 6 ký tự">
          <Input
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
            required
            minLength={6}
          />
        </Field>
        {form.role === 'student' ? (
          <Field label="Em học lớp mấy?">
            <Select value={form.gradeLevel} onChange={(e) => update('gradeLevel', Number(e.target.value))}>
              {GRADE_LEVELS.map((g) => (
                <option key={g} value={g}>
                  Lớp {g}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <p className="rounded-xl bg-sky-soft px-3 py-2 text-sm font-semibold text-sky-800">
            👩‍🏫 Tài khoản giáo viên cần quản trị viên duyệt trước khi dùng (để bảo vệ dữ liệu của các em).
            Sau khi đăng ký, thầy cô sẽ thấy trang “chờ duyệt”.
          </p>
        )}

        {error ? <ErrorBox message={error} /> : null}
        <Button type="submit" size="lg" variant="success" loading={loading}>
          Đăng ký 🎉
        </Button>
      </form>
      <p className="mt-5 text-center font-semibold text-ink-soft">
        Đã có tài khoản?{' '}
        <Link to="/login" className="text-brand underline-offset-2 hover:underline">
          Đăng nhập
        </Link>
      </p>
    </AuthCard>
  )
}
