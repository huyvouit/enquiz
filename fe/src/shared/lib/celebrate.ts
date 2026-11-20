import confetti from 'canvas-confetti'

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

const COLORS = ['#4f46e5', '#facc15', '#22c55e', '#f43f5e', '#0ea5e9', '#a855f7']

/** One burst of confetti from the bottom centre. */
export function confettiBurst() {
  if (reducedMotion()) return
  void confetti({ particleCount: 120, spread: 80, origin: { y: 0.75 }, colors: COLORS })
}

/** A longer celebration from both sides, for a level-up. */
export function confettiShower(durationMs = 1600) {
  if (reducedMotion()) return
  const end = Date.now() + durationMs
  const frame = () => {
    void confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors: COLORS })
    void confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors: COLORS })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
}
