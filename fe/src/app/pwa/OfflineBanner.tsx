import { useSyncExternalStore } from 'react'

const subscribe = (onChange: () => void) => {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}

/**
 * No playing offline (D24: answers are graded on the server), only a clear
 * message. The app itself still opens from the service worker cache.
 */
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine)
  if (online) return null
  return (
    <div
      role="alert"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-coral px-4 py-2 text-center font-bold text-white"
    >
      <span aria-hidden>📡</span> Mất mạng rồi – kết nối lại để học tiếp nhé!
    </div>
  )
}
