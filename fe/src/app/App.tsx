import { QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { useAuthStore } from '@/features/auth'
import { queryClient } from '@/shared/api/query-client'
import { OfflineBanner } from './pwa/OfflineBanner'
import { UpdatePrompt } from './pwa/UpdatePrompt'
import { router } from './router'

export function App() {
  const status = useAuthStore((s) => s.status)

  // On start-up, resume the session from the cookie (plan D22).
  useEffect(() => {
    void useAuthStore.getState().init()
    // Opened offline (from the service worker cache): resume once back online.
    const onOnline = () => {
      const { user, renew } = useAuthStore.getState()
      if (!user) renew().catch(() => {})
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [])

  // A moment on start-up; route guards need to know who is logged in.
  if (status === 'loading') {
    return (
      <>
        <OfflineBanner />
        <div className="grid min-h-dvh place-items-center bg-canvas" role="status" aria-label="Đang tải">
          <span className="text-5xl motion-safe:animate-bounce" aria-hidden>
            🦉
          </span>
        </div>
      </>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <OfflineBanner />
      <RouterProvider router={router} />
      <UpdatePrompt />
    </QueryClientProvider>
  )
}
