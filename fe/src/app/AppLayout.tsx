import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { AssignmentsBadge } from '@/features/assignments'
import { homePathFor, useAuthStore } from '@/features/auth'
import type { Role } from '@/shared/api/types'
import { cn } from '@/shared/lib/cn'
import { SoundControls } from '@/shared/sound'
import { VersionTag } from '@/shared/version'

const NAV: Record<Role, { to: string; label: string }[]> = {
  student: [
    { to: '/home', label: '🗺️ Bản đồ' },
    { to: '/assignments', label: '📬 Bài tập' },
    { to: '/live', label: '⚔️ Đấu trường' },
    { to: '/leaderboard', label: '🏆 Xếp hạng' },
    { to: '/history', label: '📒 Bài đã làm' },
  ],
  teacher: [
    { to: '/teacher/classes', label: '🏫 Lớp học' },
    { to: '/teacher', label: '🧩 Quiz' },
    { to: '/teacher/questions', label: '📚 Kho câu hỏi' },
    { to: '/teacher/live', label: '⚔️ Đấu trường' },
    { to: '/leaderboard', label: '🏆 Xếp hạng' },
  ],
  admin: [
    { to: '/admin/users', label: '👥 Tài khoản' },
    { to: '/admin/map', label: '🗺️ Bản đồ' },
    { to: '/teacher/classes', label: '🏫 Lớp học' },
    { to: '/teacher', label: '🧩 Quiz' },
    { to: '/teacher/questions', label: '📚 Kho câu hỏi' },
    { to: '/teacher/live', label: '⚔️ Đấu trường' },
    { to: '/leaderboard', label: '🏆 Xếp hạng' },
  ],
}

/** Top navigation + page container for every logged-in screen. */
export function AppLayout() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  if (!user) return null

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b-2 border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <NavLink to={homePathFor(user)} className="font-display text-3xl font-extrabold text-brand">
            En<span className="text-sunny drop-shadow-[0_2px_0_rgba(0,0,0,0.15)]">Quiz</span>
          </NavLink>
          <nav className="order-3 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
            {NAV[user.role].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) =>
                  cn(
                    'whitespace-nowrap rounded-xl px-3 py-2 font-bold transition-colors',
                    isActive ? 'bg-brand-soft text-brand-dark' : 'text-ink-soft hover:text-ink',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {user.role === 'student' ? <AssignmentsBadge /> : null}
            <SoundControls />
            {user.studentProfile ? (
              <span className="hidden rounded-full bg-brand-soft px-3 py-1 text-sm font-bold text-brand-dark sm:inline">
                🏅 Cấp {user.studentProfile.level} · ⚡ {user.studentProfile.xp} XP
              </span>
            ) : null}
            <NavLink
              to="/account/password"
              title="Đổi mật khẩu"
              className="flex items-center gap-1.5 rounded-xl px-2 py-1.5 font-bold text-ink-soft hover:text-ink"
            >
              <span aria-hidden>🔑</span>
              <span className="hidden md:inline">{user.fullName}</span>
              <span className="sr-only md:hidden">Đổi mật khẩu</span>
            </NavLink>
            <button
              type="button"
              onClick={() => {
                void logout().then(() => navigate('/login'))
              }}
              className="rounded-xl border-2 border-line px-3 py-1.5 text-sm font-bold hover:border-coral hover:text-coral"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
      <footer className="pb-6">
        <VersionTag />
      </footer>
    </div>
  )
}
