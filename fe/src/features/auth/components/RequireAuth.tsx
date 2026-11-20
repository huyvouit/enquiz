import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { Role } from '@/shared/api/types'
import { PendingApprovalPage } from '../pages/PendingApprovalPage'
import { homePathFor, useAuthStore } from '../store/auth.store'

/**
 * Route guard. Not logged in -> /login (remembering where to come back).
 * Teacher waiting for approval -> the "chờ duyệt" page instead of any screen.
 * Wrong role -> that role's home. The backend enforces the same rules;
 * this only keeps users away from screens they cannot use.
 */
export function RequireAuth({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()

  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (user.status === 'pending') return <PendingApprovalPage />
  if (roles && !roles.includes(user.role)) return <Navigate to={homePathFor(user)} replace />
  return <>{children}</>
}

/** For /login and /register: logged-in users go straight home. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (user) return <Navigate to={homePathFor(user)} replace />
  return <>{children}</>
}
