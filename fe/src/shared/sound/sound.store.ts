import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { sfx } from './sound'

interface SoundSettings {
  /** Sound effects (right/wrong, level up...). On by default. */
  effectsOn: boolean
  /** Background music. Off by default so it never surprises a classroom. */
  musicOn: boolean
  toggleEffects: () => void
  toggleMusic: () => void
}

export const useSoundSettings = create<SoundSettings>()(
  persist(
    (set) => ({
      effectsOn: true,
      musicOn: false,
      toggleEffects: () => set((s) => ({ effectsOn: !s.effectsOn })),
      toggleMusic: () => set((s) => ({ musicOn: !s.musicOn })),
    }),
    { name: 'enquiz-sound' },
  ),
)

/** Plays an effect only if effects are enabled. Usable outside React. */
export function playSfx(name: keyof typeof sfx) {
  if (useSoundSettings.getState().effectsOn) sfx[name]()
}
