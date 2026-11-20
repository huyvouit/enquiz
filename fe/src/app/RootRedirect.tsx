import { Navigate } from 'react-router-dom'
import { homePathFor, useAuthStore } from '@/features/auth'

/** "/" sends each role to its own home page. */
export function RootRedirect() {
  const user = useAuthStore((s) => s.user)
  return <Navigate to={homePathFor(user)} replace />
}
