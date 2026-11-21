import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { errorMessage } from '@/shared/api/http'
import { Button, Card, ErrorBox, Field, Input, PageHeader } from '@/shared/components'
import { homePathFor, useAuthStore } from '../store/auth.store'

/** Same rules as the server (plan D20): admins need a longer password. */
const minLength = (role: string) => (role === 'admin' ? 12 : 6)

export function ChangePasswordPage() {
  const user = useAuthStore((s) => s.user)
  const changePassword = useAuthStore((s) => s.changePassword)
  const navigate = useNavigate()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  if (!user) return null
  const min = minLength(user.role)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (next.length < min) return setError(`Mật khẩu mới cần ít nhất ${min} ký tự`)
    if (next !== confirm) return setError('Hai lần nhập mật khẩu mới chưa giống nhau')
    if (next === current) return setError('Mật khẩu mới phải khác mật khẩu hiện tại')
    setLoading(true)
    try {
      await changePassword(current, next)
      setDone(true)
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const type = show ? 'text' : 'password'
  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="🔑 Đổi mật khẩu" subtitle={`Tài khoản: ${user.username}`} />
      <Card>
        {done ? (
          <div className="flex flex-col items-center gap-4 text-center" role="status">
            <span className="text-5xl" aria-hidden>
              ✅
            </span>
            <p className="font-display text-xl font-bold">Đã đổi mật khẩu</p>
            <p className="text-ink-soft">
              Máy này vẫn đăng nhập. Các máy khác đang dùng tài khoản này sẽ phải đăng nhập lại bằng mật khẩu mới.
            </p>
            <Button onClick={() => navigate(homePathFor(user))}>Về trang chủ</Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <Field label="Mật khẩu hiện tại">
              <Input
                type={type}
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
                autoFocus
              />
            </Field>
            <Field label="Mật khẩu mới" hint={`Ít nhất ${min} ký tự, khác tên đăng nhập`}>
              <Input
                type={type}
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                minLength={min}
                maxLength={72}
                required
              />
            </Field>
            <Field label="Nhập lại mật khẩu mới">
              <Input
                type={type}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                maxLength={72}
                required
              />
            </Field>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink-soft">
              <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
              Hiện mật khẩu
            </label>
            {error ? <ErrorBox message={error} /> : null}
            <Button type="submit" size="lg" loading={loading}>
              Đổi mật khẩu
            </Button>
          </form>
        )}
      </Card>
    </div>
  )
}
