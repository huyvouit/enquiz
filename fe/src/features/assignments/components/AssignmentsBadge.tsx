import { NavLink } from 'react-router-dom'
import { cn } from '@/shared/lib/cn'
import { useReminders } from '../hooks/useAssignments'

/** Header link for students: 📬 with the number of homework not submitted yet. */
export function AssignmentsBadge() {
  const { data } = useReminders()
  const count = data?.pendingCount ?? 0
  return (
    <NavLink
      to="/assignments"
      aria-label={count > 0 ? `Bài tập: ${count} bài chưa làm` : 'Bài tập'}
      className={({ isActive }) =>
        cn(
          'relative inline-flex size-10 items-center justify-center rounded-xl text-2xl transition-colors',
          isActive ? 'bg-brand-soft' : 'hover:bg-slate-100',
        )
      }
    >
      <span aria-hidden>📬</span>
      {count > 0 ? (
        <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-coral px-1.5 text-center text-xs font-bold leading-5 text-white">
          {count > 9 ? '9+' : count}
        </span>
      ) : null}
    </NavLink>
  )
}
