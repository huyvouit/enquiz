import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { useAuthStore } from '@/features/auth'
import { queryClient } from '@/shared/api/query-client'
import { router } from './router'

export function App() {
  const token = useAuthStore((s) => s.token)
  const refreshProfile = useAuthStore((s) => s.refreshProfile)

  // On start-up, re-validate a persisted session (a 401 logs the user out).
  useEffect(() => {
    if (token) refreshProfile().catch(() => {})
    // Only once per app start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
