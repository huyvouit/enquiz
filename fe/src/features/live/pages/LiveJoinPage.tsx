import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/features/auth'
import { errorMessage } from '@/shared/api/http'
import { Button, Card, ErrorBox, Mascot } from '@/shared/components'
import { liveApi } from '../api/live.api'
import { readStoredPlayer, storePlayer } from '../hooks/usePlayerSession'
import type { LivePinInfo } from '../types'

const onlyDigits = (s: string) => s.replace(/\D/g, '').slice(0, 6)

/**
 * /live — enter the PIN from the projector (or arrive from its QR code with
 * ?pin=). Students join with their account; visitors without one choose a
 * nickname when the room allows guests (plan 5.3).
 */
export function LiveJoinPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [pin, setPin] = useState(() => onlyDigits(params.get('pin') ?? ''))
  const [guestRoom, setGuestRoom] = useState<LivePinInfo | null>(null)
  const [needsLogin, setNeedsLogin] = useState(false)
  const [nickname, setNickname] = useState(() => readStoredPlayer()?.nickname ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function enter(nick?: string) {
    const previous = readStoredPlayer()
    // Same room again (back button): keep the guest's place and token.
    storePlayer(
      previous?.pin === pin && (!nick || previous.nickname === nick)
        ? { ...previous, nickname: nick ?? previous.nickname }
        : { pin, nickname: nick },
    )
    navigate('/live/play')
  }

  async function submitPin(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (pin.length !== 6) return setError('Mã PIN gồm 6 chữ số')
    // Students go straight in: the server checks the PIN per account.
    if (user?.role === 'student') return enter()
    setBusy(true)
    try {
      const info = await liveApi.checkPin(pin)
      if (info.allowGuests) setGuestRoom(info)
      else setNeedsLogin(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  function submitNickname(e: FormEvent) {
    e.preventDefault()
    const nick = nickname.trim().replace(/\s+/g, ' ')
    if (nick.length < 2 || nick.length > 16) return setError('Biệt danh dài từ 2 đến 16 ký tự')
    enter(nick)
  }

  const staff = user && user.role !== 'student'

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-canvas px-4 py-10">
      <Link to="/" className="font-display text-3xl font-extrabold text-brand">
        En<span className="text-sunny">Quiz</span> ⚔️
      </Link>
      <Card className="flex w-full max-w-md flex-col gap-5 text-center">
        <h1 className="text-3xl font-extrabold">Đấu trường</h1>

        {staff ? (
          <>
            <p className="font-semibold">Giáo viên mở phòng và chiếu màn hình ở mục Đấu trường.</p>
            <Button onClick={() => navigate('/teacher/live')}>⚔️ Mở phòng đấu</Button>
          </>
        ) : guestRoom ? (
          <form onSubmit={submitNickname} className="flex flex-col gap-4">
            <p className="text-lg font-bold">
              {guestRoom.coverEmoji} {guestRoom.quizTitle}
            </p>
            <label className="flex flex-col gap-2 text-left font-bold">
              Biệt danh của em
              <input
                autoFocus
                value={nickname}
                maxLength={16}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Ví dụ: Mèo Con"
                className="min-h-16 rounded-2xl border-4 border-line px-4 text-center text-2xl font-bold outline-none focus:border-brand"
              />
            </label>
            <p className="text-sm text-ink-soft">Không cần tài khoản. Điểm chỉ dùng trong trận này.</p>
            {error ? <ErrorBox message={error} /> : null}
            <Button type="submit" size="lg" variant="success" className="min-h-14">
              Vào chơi ▶
            </Button>
            <button type="button" className="text-sm font-bold text-brand" onClick={() => setGuestRoom(null)}>
              ← Đổi mã PIN
            </button>
          </form>
        ) : needsLogin ? (
          <div className="flex flex-col gap-4">
            <Mascot mood="happy" message="Phòng này dành cho học sinh có tài khoản. Em đăng nhập rồi vào lại nhé!" />
            <Button size="lg" onClick={() => navigate('/login', { state: { from: `/live?pin=${pin}` } })}>
              Đăng nhập
            </Button>
            <button type="button" className="text-sm font-bold text-brand" onClick={() => setNeedsLogin(false)}>
              ← Đổi mã PIN
            </button>
          </div>
        ) : (
          <form onSubmit={submitPin} className="flex flex-col gap-4">
            <label className="flex flex-col gap-2 font-bold">
              Nhập mã PIN trên màn hình của cô
              <input
                autoFocus
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                onChange={(e) => setPin(onlyDigits(e.target.value))}
                placeholder="123456"
                aria-label="Mã PIN"
                className="min-h-20 rounded-2xl border-4 border-line text-center font-display text-5xl font-extrabold tracking-[0.3em] outline-none focus:border-brand"
              />
            </label>
            {error ? <ErrorBox message={error} /> : null}
            <Button type="submit" size="lg" className="min-h-14" loading={busy} disabled={pin.length !== 6}>
              Vào phòng ▶
            </Button>
            {user ? (
              <p className="text-sm text-ink-soft">Em vào bằng tài khoản {user.fullName}.</p>
            ) : (
              <p className="text-sm text-ink-soft">
                Có tài khoản?{' '}
                <Link to="/login" state={{ from: `/live${pin ? `?pin=${pin}` : ''}` }} className="font-bold text-brand">
                  Đăng nhập
                </Link>{' '}
                để được lưu điểm.
              </p>
            )}
          </form>
        )}
      </Card>
    </div>
  )
}
