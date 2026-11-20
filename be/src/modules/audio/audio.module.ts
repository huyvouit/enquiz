import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../../config/env.validation.js';
import { UploadsModule } from '../uploads/uploads.module.js';
import { QuestionAudioService } from './question-audio.service.js';
import {
  FakeTtsProvider,
  GoogleTtsProvider,
  SPEAKING_RATE,
  TTS_PROVIDER,
  type TtsProvider,
} from './tts.js';

/** Text-to-speech for listening questions (plan D16), chosen by TTS_DRIVER. */
@Module({
  imports: [UploadsModule],
  providers: [
    {
      provide: TTS_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>): TtsProvider | null => {
        switch (config.get('TTS_DRIVER')) {
          case 'google':
            return new GoogleTtsProvider(config.get('GOOGLE_TTS_API_KEY'), {
              language: config.get('TTS_LANGUAGE'),
              name: config.get('TTS_VOICE'),
              speakingRate: SPEAKING_RATE,
            });
          case 'fake':
            return new FakeTtsProvider();
          default:
            return null;
        }
      },
    },
    QuestionAudioService,
  ],
  exports: [QuestionAudioService],
})
export class AudioModule {}
