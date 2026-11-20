import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { useSoundSettings } from '@/shared/sound'

/**
 * Big round 🔊 button for listening questions. Plays the MP3 made by the
 * server (plan D16) once when the question appears (only when sound effects
 * are on) and again on every tap.
 *
 * Without `url` the audio is not ready yet: the child is told so, and the
 * teacher in preview learns how to fix it.
 */
export function ListenButton({ url, preview = false }: { url?: string; preview?: boolean }) {
  const effectsOn = useSoundSettings((s) => s.effectsOn)
  const reduceMotion = useReducedMotion()
  const audio = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!url) return
    const el = new Audio(url)
    audio.current = el
    const stop = () => setPlaying(false)
    el.addEventListener('play', () => setPlaying(true))
    el.addEventListener('ended', stop)
    el.addEventListener('pause', stop)
    el.addEventListener('error', () => {
      setPlaying(false)
      setFailed(true)
    })
    // Auto-play once per question; the browser may refuse before any tap.
    if (effectsOn) void el.play().catch(() => undefined)
    return () => {
      el.pause()
      audio.current = null
    }
    // Runs once per question (the stage remounts per question).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  function play() {
    const el = audio.current
    if (!el) return
    el.currentTime = 0
    void el.play().catch(() => setFailed(true))
  }

  if (!url || failed) {
    return (
      <div className="mx-auto mb-4 max-w-md rounded-2xl bg-sunny-soft px-4 py-3 text-sm font-bold text-yellow-900">
        {preview ? (
          <p>
            ⚠️ Câu nghe này chưa có âm thanh. Hãy mở câu hỏi và bấm Lưu lại, hoặc nhờ quản trị viên tạo âm thanh
            trong Kho câu hỏi.
          </p>
        ) : (
          <p>🔇 Chưa nghe được câu này. Em báo cô/thầy nhé!</p>
        )}
      </div>
    )
  }

  return (
    <div className="mb-4 flex justify-center">
      <motion.button
        type="button"
        onClick={play}
        aria-label="Nghe lại"
        whileTap={reduceMotion ? undefined : { scale: 0.92 }}
        animate={playing && !reduceMotion ? { scale: [1, 1.08, 1] } : { scale: 1 }}
        transition={playing ? { repeat: Infinity, duration: 0.8 } : { duration: 0.2 }}
        className="flex size-24 items-center justify-center rounded-full border-4 border-sky bg-sky-soft text-5xl shadow-pop-sm"
      >
        <span aria-hidden>🔊</span>
      </motion.button>
    </div>
  )
}
