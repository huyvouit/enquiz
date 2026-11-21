import { useEffect, useState } from 'react'

/**
 * Milliseconds the device clock is behind the server (plan 5, L6): measured
 * on each snapshot so timers show the server's countdown, not the tablet's.
 */
export function clockOffset(serverNow: string): number {
  return new Date(serverNow).getTime() - Date.now()
}

/** Whole seconds until `endsAt` (server time), updated 4 times a second. */
export function useSecondsLeft(endsAt: string | null, serverNow: string): number | null {
  const [offset, setOffset] = useState(() => clockOffset(serverNow))
  const [now, setNow] = useState(() => Date.now())
  const [seenServerNow, setSeenServerNow] = useState(serverNow)
  if (seenServerNow !== serverNow) {
    // New snapshot: measure the clock again (adjusting state during render).
    setSeenServerNow(serverNow)
    setOffset(clockOffset(serverNow))
  }

  useEffect(() => {
    if (!endsAt) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [endsAt])

  if (!endsAt) return null
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - (now + offset)) / 1000))
}
