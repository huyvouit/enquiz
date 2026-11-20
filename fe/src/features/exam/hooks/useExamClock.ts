import { useEffect, useState } from 'react'

const secondsUntil = (deadline: number, offsetMs: number) =>
  Math.max(0, Math.ceil((deadline - (Date.now() + offsetMs)) / 1000))

/**
 * Seconds left until `deadlineAt`, by the server's clock (plan E1).
 * The device clock may be wrong: the gap between the server time sent with
 * the session and the device time on arrival is measured once and applied.
 */
export function useExamClock(deadlineAt: string, serverNow: string): number {
  const [offsetMs] = useState(() => new Date(serverNow).getTime() - Date.now())
  const deadline = new Date(deadlineAt).getTime()
  const [secondsLeft, setSecondsLeft] = useState(() => secondsUntil(deadline, offsetMs))

  useEffect(() => {
    const id = window.setInterval(() => setSecondsLeft(secondsUntil(deadline, offsetMs)), 250)
    return () => window.clearInterval(id)
  }, [deadline, offsetMs])

  return secondsLeft
}

/** "07:05" */
export function formatClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
