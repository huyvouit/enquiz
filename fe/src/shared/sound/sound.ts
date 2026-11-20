/**
 * Tiny sound engine built on the Web Audio API: every effect is synthesised,
 * so there are no audio files to load or license.
 * Browsers only allow audio after a user gesture; the context is created
 * lazily and resumed on the first tap (see `unlockAudioOnFirstGesture`).
 */

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

interface Note {
  freq: number
  /** Seconds from now. */
  at: number
  dur: number
  type?: OscillatorType
  gain?: number
}

function play(notes: Note[]) {
  const ac = audio()
  if (!ac) return
  const now = ac.currentTime
  for (const n of notes) {
    const osc = ac.createOscillator()
    const amp = ac.createGain()
    osc.type = n.type ?? 'triangle'
    osc.frequency.value = n.freq
    const start = now + n.at
    const peak = n.gain ?? 0.18
    // Short attack and exponential release: soft "pling" instead of a click.
    amp.gain.setValueAtTime(0.0001, start)
    amp.gain.exponentialRampToValueAtTime(peak, start + 0.015)
    amp.gain.exponentialRampToValueAtTime(0.0001, start + n.dur)
    osc.connect(amp).connect(ac.destination)
    osc.start(start)
    osc.stop(start + n.dur + 0.05)
  }
}

const C5 = 523.25
const E5 = 659.25
const G5 = 783.99
const C6 = 1046.5
const E6 = 1318.5

export const sfx = {
  /** "Ting-ting" for a right answer. */
  correct: () =>
    play([
      { freq: C6, at: 0, dur: 0.18 },
      { freq: E6, at: 0.09, dur: 0.3 },
    ]),
  /** Gentle, low "boop-boop" — not scary. */
  wrong: () =>
    play([
      { freq: 330, at: 0, dur: 0.18, type: 'sine', gain: 0.14 },
      { freq: 262, at: 0.14, dur: 0.28, type: 'sine', gain: 0.14 },
    ]),
  tap: () => play([{ freq: 880, at: 0, dur: 0.05, type: 'sine', gain: 0.06 }]),
  /** Short fanfare when a quiz is finished. */
  finish: () =>
    play([
      { freq: C5, at: 0, dur: 0.15 },
      { freq: E5, at: 0.12, dur: 0.15 },
      { freq: G5, at: 0.24, dur: 0.15 },
      { freq: C6, at: 0.36, dur: 0.45 },
    ]),
  /** Bigger arpeggio + sparkle for a level-up. */
  levelUp: () =>
    play([
      { freq: C5, at: 0, dur: 0.12 },
      { freq: E5, at: 0.1, dur: 0.12 },
      { freq: G5, at: 0.2, dur: 0.12 },
      { freq: C6, at: 0.3, dur: 0.2 },
      { freq: G5, at: 0.45, dur: 0.12 },
      { freq: C6, at: 0.55, dur: 0.6 },
      { freq: E6, at: 0.55, dur: 0.6, gain: 0.08 },
      { freq: 2093, at: 0.75, dur: 0.25, type: 'sine', gain: 0.05 },
      { freq: 2637, at: 0.85, dur: 0.3, type: 'sine', gain: 0.05 },
    ]),
  locked: () => play([{ freq: 196, at: 0, dur: 0.15, type: 'square', gain: 0.05 }]),
}

/* ---------------- Background music ---------------- */

// A calm C-major pentatonic tune (two bars, repeating).
const MELODY = [C5, E5, G5, E5, 587.33, G5, 880, G5, C5, 587.33, E5, G5, E5, 587.33, C5, 392]
const BEAT_SEC = 0.42
let musicTimer: ReturnType<typeof setInterval> | null = null
let step = 0

export function startMusic() {
  if (musicTimer || !audio()) return
  const tick = () => {
    const note = MELODY[step % MELODY.length]
    const notes: Note[] = [{ freq: note, at: 0, dur: BEAT_SEC * 0.9, type: 'sine', gain: 0.045 }]
    // Soft bass on every 4th beat.
    if (step % 4 === 0) notes.push({ freq: note / 4, at: 0, dur: BEAT_SEC * 3, type: 'sine', gain: 0.035 })
    play(notes)
    step++
  }
  tick()
  musicTimer = setInterval(tick, BEAT_SEC * 1000)
}

export function stopMusic() {
  if (musicTimer) clearInterval(musicTimer)
  musicTimer = null
}

/** Resume audio on the first tap anywhere (browser autoplay policy). */
export function unlockAudioOnFirstGesture(onUnlock: () => void) {
  const handler = () => {
    audio()
    onUnlock()
    window.removeEventListener('pointerdown', handler)
    window.removeEventListener('keydown', handler)
  }
  window.addEventListener('pointerdown', handler)
  window.addEventListener('keydown', handler)
  return () => {
    window.removeEventListener('pointerdown', handler)
    window.removeEventListener('keydown', handler)
  }
}
