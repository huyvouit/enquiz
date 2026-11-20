import { createHash } from 'node:crypto';

/** Turns English text into MP3 bytes (plan D16). */
export interface TtsProvider {
  synthesize(text: string): Promise<Buffer>;
}

export interface TtsVoice {
  /** BCP-47, e.g. en-GB. */
  language: string;
  /** Exact voice name, or '' for the API's default voice of that language. */
  name: string;
  /** Slower than normal speech for young learners (the old browser voice used 0.85). */
  speakingRate: number;
}

export const SPEAKING_RATE = 0.85;

export const TTS_PROVIDER = Symbol('TTS_PROVIDER');

const SYNTHESIZE_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';

/** Google Cloud Text-to-Speech over REST with an API key (no extra dependency). */
export class GoogleTtsProvider implements TtsProvider {
  constructor(
    private readonly apiKey: string,
    private readonly voice: TtsVoice,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async synthesize(text: string): Promise<Buffer> {
    const res = await this.fetchFn(SYNTHESIZE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
      },
      body: JSON.stringify({
        input: { text },
        voice: {
          languageCode: this.voice.language,
          ...(this.voice.name ? { name: this.voice.name } : {}),
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: this.voice.speakingRate,
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      // The body explains the problem (bad key, API not enabled…); never the key itself.
      const detail = (await res.text()).slice(0, 300);
      throw new Error(`Text-to-Speech ${res.status}: ${detail}`);
    }
    const { audioContent } = (await res.json()) as { audioContent?: string };
    if (!audioContent) throw new Error('Text-to-Speech returned no audio');
    return Buffer.from(audioContent, 'base64');
  }
}

/** Tests: deterministic bytes, no network. */
export class FakeTtsProvider implements TtsProvider {
  synthesize(text: string): Promise<Buffer> {
    return Promise.resolve(Buffer.from(`FAKE-MP3:${text}`, 'utf8'));
  }
}

/**
 * Content-addressed key: the same text and voice always give the same file,
 * so re-saving a question never makes a new one and a changed text or voice
 * does. Never reveals the text itself.
 */
export function audioKey(text: string, voice: TtsVoice): string {
  const hash = createHash('sha256')
    .update(
      JSON.stringify([voice.language, voice.name, voice.speakingRate, text]),
    )
    .digest('hex');
  return `${hash.slice(0, 32)}.mp3`;
}
