import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { errorMessage } from '@/shared/api/http'
import { Button, ErrorBox, Field, Input } from '@/shared/components'
import { AuthCard } from '../components/AuthCard'
import { homePathFor, useAuthStore } from '../store/auth.store'

export function LoginPage() {
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const user = await login({ username, password })
      const from = (location.state as { from?: string } | null)?.from
      navigate(from ?? homePathFor(user), { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard title="Đăng nhập" mascotSays="Chào em! Cùng học tiếng Anh nào! 👋">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label="Tên đăng nhập">
          <Input
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
          />
        </Field>
        <Field label="Mật khẩu">
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        {error ? <ErrorBox message={error} /> : null}
        <Button type="submit" size="lg" loading={loading}>
          Vào học thôi! 🚀
        </Button>
      </form>
      <p className="mt-5 text-center font-semibold text-ink-soft">
        Chưa có tài khoản?{' '}
        <Link to="/register" className="text-brand underline-offset-2 hover:underline">
          Đăng ký
        </Link>
      </p>
    </AuthCard>
  )
}
