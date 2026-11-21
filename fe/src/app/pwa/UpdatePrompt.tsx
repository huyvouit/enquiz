import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { api } from '@/shared/api/http'
import { APP_VERSION } from '@/shared/version'
import { router } from '../router'
import { compareVersions, isBusyRoute } from './busy-route'

const CHECK_EVERY_MS = 30 * 60_000
const FORCED_KEY = 'enquiz.forcedUpdate'

const usePathname = () =>
  useSyncExternalStore(
    (onChange) => router.subscribe(onChange),
    () => router.state.location.pathname,
  )

/** Whether this build is older than the oldest the API still supports (D25). */
async function belowMinimum(): Promise<boolean> {
  try {
    const { minClientVersion } = await api.get<{ minClientVersion?: string }>('/health')
    return compareVersions(APP_VERSION, minClientVersion ?? '0.0.0') === -1
  } catch {
    return false // offline: try again later
  }
}

/** One forced reload per minimum version and tab, so a stale cache cannot loop. */
function forcedOnce(): boolean {
  try {
    if (sessionStorage.getItem(FORCED_KEY) === APP_VERSION) return false
    sessionStorage.setItem(FORCED_KEY, APP_VERSION)
  } catch {
    return false
  }
  return true
}

/**
 * Registers the service worker (6.3) and handles new versions (6.4, D25):
 * - a new build is installed in the background, then the bar
 *   "EnQuiz có bản mới – Cập nhật" appears; tapping it reloads into it;
 * - `minClientVersion` from /health above this build forces the update;
 * - neither interrupts an exam, a quiz or a live match (isBusyRoute):
 *   they wait until the user leaves it.
 */
export function UpdatePrompt() {
  const pathname = usePathname()
  const busy = isBusyRoute(pathname)
  const [mustUpdate, setMustUpdate] = useState(false)
  const registration = useRef<ServiceWorkerRegistration | null>(null)

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      registration.current = reg ?? null
    },
  })

  // Look for a new build every 30 minutes and when the tab comes back.
  useEffect(() => {
    const check = async () => {
      if (!navigator.onLine) return
      await registration.current?.update().catch(() => {})
      if (await belowMinimum()) setMustUpdate(true)
    }
    void check()
    const timer = setInterval(() => void check(), CHECK_EVERY_MS)
    const onVisible = () => document.visibilityState === 'visible' && void check()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  // Forced update: as soon as the user is not in the middle of something.
  // A reload alone would bring back the precached old build: wait until the
  // new service worker is installed (needRefresh), then switch to it.
  useEffect(() => {
    if (!mustUpdate || busy) return
    if (needRefresh) {
      if (forcedOnce()) void updateServiceWorker(true)
    } else if (!('serviceWorker' in navigator) && forcedOnce()) {
      window.location.reload() // no service worker in this browser: a reload is enough
    }
  }, [mustUpdate, busy, needRefresh, updateServiceWorker])

  if (busy || !(needRefresh || mustUpdate)) return null
  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border-2 border-brand bg-surface px-4 py-3 shadow-pop sm:bottom-5"
    >
      <span className="text-2xl" aria-hidden>
        🎉
      </span>
      <p className="flex-1 font-bold">
        {mustUpdate ? 'Cần cập nhật EnQuiz để dùng tiếp' : 'EnQuiz có bản mới'}
      </p>
      <button
        type="button"
        onClick={() => (needRefresh ? void updateServiceWorker(true) : window.location.reload())}
        className="min-h-11 rounded-xl bg-brand px-4 font-bold text-white hover:bg-brand-dark"
      >
        Cập nhật
      </button>
    </div>
  )
}
