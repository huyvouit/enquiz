import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { errorMessage } from '@/shared/api/http'
import { Button, ErrorBox } from '@/shared/components'
import { AuthCard } from '../components/AuthCard'
import { useAuthStore } from '../store/auth.store'

/**
 * Shown instead of every logged-in screen while a self-registered teacher
 * waits for an admin (plan D6). The backend refuses their requests with 403
 * anyway; this page explains why and lets them check again.
 */
export function PendingApprovalPage() {
  const user = useAuthStore((s) => s.user)
  const refreshProfile = useAuthStore((s) => s.refreshProfile)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const [checking, setChecking] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function checkAgain() {
    setChecking(true)
    setError(null)
    setNote(null)
    try {
      await refreshProfile()
      // Still pending: the gate keeps showing this page.
      if (useAuthStore.getState().user?.status === 'pending') {
        setNote('Tài khoản vẫn đang chờ duyệt. Thầy cô vui lòng thử lại sau nhé.')
      }
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setChecking(false)
    }
  }

  return (
    <AuthCard
      title="Tài khoản đang chờ quản trị viên duyệt"
      mascotSays="Cảm ơn thầy cô đã đăng ký! Cú Mèo đang báo cho quản trị viên 🦉"
    >
      <div className="flex flex-col gap-4 font-semibold text-ink-soft">
        <p>
          Chào <span className="text-ink">{user?.fullName}</span>! Vì giáo viên sẽ xem được kết quả học tập
          của các em, mỗi tài khoản giáo viên mới cần được quản trị viên duyệt trước khi tạo lớp, câu hỏi và
          quiz.
        </p>
        <p>Khi đã được duyệt, bấm “Kiểm tra lại” (hoặc đăng nhập lại) để bắt đầu.</p>
        {note ? (
          <p role="status" className="rounded-xl bg-sunny-soft px-3 py-2 text-yellow-800">
            {note}
          </p>
        ) : null}
        {error ? <ErrorBox message={error} /> : null}
        <div className="flex flex-wrap gap-3">
          <Button onClick={checkAgain} loading={checking}>
            🔄 Kiểm tra lại
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              void logout().then(() => navigate('/login', { replace: true }))
            }}
          >
            Đăng xuất
          </Button>
        </div>
      </div>
    </AuthCard>
  )
}
