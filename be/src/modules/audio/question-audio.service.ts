import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../../config/env.validation.js';
import { AudioStorageService } from '../uploads/audio-storage.js';
import {
  audioKey,
  SPEAKING_RATE,
  TTS_PROVIDER,
  type TtsProvider,
  type TtsVoice,
} from './tts.js';

/**
 * Makes the audio of a listening question when it is saved (plan D16), so
 * students only ever receive a URL and never the text that would give the
 * answer away.
 */
@Injectable()
export class QuestionAudioService {
  private readonly logger = new Logger(QuestionAudioService.name);
  private readonly voice: TtsVoice;

  constructor(
    @Inject(TTS_PROVIDER) private readonly tts: TtsProvider | null,
    private readonly storage: AudioStorageService,
    config: ConfigService<AppEnv, true>,
  ) {
    this.voice = {
      language: config.get('TTS_LANGUAGE'),
      name: config.get('TTS_VOICE'),
      speakingRate: SPEAKING_RATE,
    };
  }

  /** False with TTS_DRIVER=none: questions keep their text but get no audio. */
  get enabled(): boolean {
    return this.tts !== null;
  }

  /**
   * URL of the audio for `text`, making it first if needed. `undefined` when
   * there is no text, TTS is off, or it failed: the question is still saved,
   * shows "no audio yet", and is filled later by the backfill.
   */
  async urlFor(text: string | undefined): Promise<string | undefined> {
    if (!text || !this.tts) return undefined;
    const key = audioKey(text, this.voice);
    try {
      if (!(await this.storage.disk.exists(key))) {
        const mp3 = await this.tts.synthesize(text);
        await this.storage.disk.put(key, mp3, {
          contentType: 'audio/mpeg',
          cacheControl: 'public, max-age=31536000, immutable',
        });
      }
      return this.storage.publicUrl(key);
    } catch (err) {
      this.logger.warn(
        `No audio for a listening question: ${err instanceof Error ? err.message : String(err)}`,
      );
      return undefined;
    }
  }

  /** `urlFor` for many questions (CSV import), a few TTS calls at a time. */
  async fill<T extends { audioText?: string; audioUrl?: string }>(
    docs: T[],
    concurrency = 4,
  ): Promise<void> {
    const queue = docs.filter((d) => d.audioText);
    const worker = async () => {
      for (let d = queue.shift(); d; d = queue.shift()) {
        d.audioUrl = await this.urlFor(d.audioText);
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
  }
}
