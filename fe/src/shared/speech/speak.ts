/**
 * Text-to-speech for listening questions (plan D11): the browser reads the
 * English text, so no audio files are stored. Voices load asynchronously in
 * most browsers, so the voice is chosen at speak time.
 */

const ENGLISH = /^en(-|_|$)/i
const PREFERRED = ['en-US', 'en-GB']

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
}

function englishVoices(): SpeechSynthesisVoice[] {
  if (!canSpeak()) return []
  return window.speechSynthesis.getVoices().filter((v) => ENGLISH.test(v.lang))
}

/** en-US first, then en-GB, then any English voice (local voices preferred). */
function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = englishVoices()
  for (const lang of PREFERRED) {
    const exact = voices.filter((v) => v.lang.replace('_', '-').toLowerCase() === lang.toLowerCase())
    const local = exact.find((v) => v.localService)
    if (local ?? exact[0]) return local ?? exact[0]
  }
  return voices[0]
}

export function hasEnglishVoice(): boolean {
  return englishVoices().length > 0
}

/**
 * Resolves once the voice list is known (it is empty until the browser has
 * loaded it). Gives up after `timeoutMs` so callers never hang.
 */
export function voicesReady(timeoutMs = 1500): Promise<boolean> {
  if (!canSpeak()) return Promise.resolve(false)
  if (window.speechSynthesis.getVoices().length > 0) return Promise.resolve(hasEnglishVoice())
  return new Promise((resolve) => {
    const done = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', done)
      clearTimeout(timer)
      resolve(hasEnglishVoice())
    }
    const timer = setTimeout(done, timeoutMs)
    window.speechSynthesis.addEventListener('voiceschanged', done)
  })
}

/** Reads `text` aloud in English, slowly for young learners. Returns false if impossible. */
export function speak(text: string, options: { rate?: number } = {}): boolean {
  if (!canSpeak() || !text.trim()) return false
  const voice = pickVoice()
  if (!voice) return false
  const synth = window.speechSynthesis
  synth.cancel() // never queue: a new tap restarts the sentence
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.voice = voice
  utterance.lang = voice.lang
  utterance.rate = options.rate ?? 0.85
  synth.speak(utterance)
  return true
}

export function stopSpeaking(): void {
  if (canSpeak()) window.speechSynthesis.cancel()
}
