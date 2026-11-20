import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { canSpeak, speak, stopSpeaking, voicesReady } from '@/shared/speech'
import { useSoundSettings } from '@/shared/sound'

/**
 * Big round 🔊 button for listening questions. Reads `text` once when the
 * question appears (only when sound effects are on) and again on every tap.
 * Without an English voice it shows the text instead, and warns the teacher
 * in preview mode.
 */
export function ListenButton({ text, preview = false }: { text: string; preview?: boolean }) {
  const effectsOn = useSoundSettings((s) => s.effectsOn)
  const reduceMotion = useReducedMotion()
  const [available, setAvailable] = useState<boolean | null>(canSpeak() ? null : false)
  const [speaking, setSpeaking] = useState(false)

  useEffect(() => {
    let cancelled = false
    void voicesReady().then((ok) => {
      if (cancelled) return
      setAvailable(ok)
      // Auto-play once per question; the button always works when muted.
      if (ok && effectsOn) play()
    })
    return () => {
      cancelled = true
      stopSpeaking()
    }
    // Runs once per text (the stage remounts per question).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  function play() {
    if (!speak(text)) return
    setSpeaking(true)
    window.setTimeout(() => setSpeaking(false), Math.min(4000, 600 + text.length * 90))
  }

  if (available === false) {
    return (
      <div className="mx-auto mb-4 max-w-md rounded-2xl bg-sunny-soft px-4 py-3 text-sm font-bold text-yellow-900">
        {preview ? (
          <p className="mb-1">⚠️ Máy này chưa có giọng đọc tiếng Anh. Học sinh dùng máy như vậy sẽ thấy chữ thay vì nghe.</p>
        ) : null}
        <p>
          Máy chưa có giọng đọc tiếng Anh: <span className="font-display text-lg text-ink">“{text}”</span>
        </p>
      </div>
    )
  }

  return (
    <div className="mb-4 flex justify-center">
      <motion.button
        type="button"
        onClick={play}
        disabled={available === null}
        aria-label="Nghe lại"
        whileTap={reduceMotion ? undefined : { scale: 0.92 }}
        animate={speaking && !reduceMotion ? { scale: [1, 1.08, 1] } : { scale: 1 }}
        transition={speaking ? { repeat: Infinity, duration: 0.8 } : { duration: 0.2 }}
        className="flex size-24 items-center justify-center rounded-full border-4 border-sky bg-sky-soft text-5xl shadow-pop-sm disabled:opacity-60"
      >
        <span aria-hidden>🔊</span>
      </motion.button>
    </div>
  )
}
