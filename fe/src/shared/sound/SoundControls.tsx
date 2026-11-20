import { useEffect } from 'react'
import { cn } from '../lib/cn'
import { startMusic, stopMusic, unlockAudioOnFirstGesture } from './sound'
import { useSoundSettings } from './sound.store'

/** Header buttons for effects and music; also drives the music loop. */
export function SoundControls() {
  const { effectsOn, musicOn, toggleEffects, toggleMusic } = useSoundSettings()

  useEffect(() => {
    if (!musicOn) {
      stopMusic()
      return
    }
    // Autoplay policy: music can only start after the first tap after a reload.
    startMusic()
    const cleanup = unlockAudioOnFirstGesture(startMusic)
    return () => {
      cleanup()
      stopMusic()
    }
  }, [musicOn])

  const btn = 'grid size-9 place-items-center rounded-full border-2 text-lg transition-colors'
  return (
    <div className="flex gap-1.5">
      <button
        type="button"
        onClick={toggleEffects}
        aria-pressed={effectsOn}
        aria-label={effectsOn ? 'Tắt âm thanh' : 'Bật âm thanh'}
        title={effectsOn ? 'Tắt âm thanh' : 'Bật âm thanh'}
        className={cn(btn, effectsOn ? 'border-brand/40 bg-brand-soft' : 'border-line opacity-60')}
      >
        {effectsOn ? '🔊' : '🔇'}
      </button>
      <button
        type="button"
        onClick={toggleMusic}
        aria-pressed={musicOn}
        aria-label={musicOn ? 'Tắt nhạc nền' : 'Bật nhạc nền'}
        title={musicOn ? 'Tắt nhạc nền' : 'Bật nhạc nền'}
        className={cn(btn, musicOn ? 'border-brand/40 bg-brand-soft' : 'border-line opacity-60')}
      >
        🎵
      </button>
    </div>
  )
}
