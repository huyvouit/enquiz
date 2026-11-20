import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDisk, StorageDisk } from '@nestjs/storage';
import { API_PREFIX } from '../../common/setup-app.js';
import type { AppEnv } from '../../config/env.validation.js';

export const AUDIO_DISK = 'audio';
/** Keys are content hashes, "<32 hex>.mp3": nothing else is ever served. */
export const AUDIO_KEY_PATTERN = /^[0-9a-f]{32}\.mp3$/;

/** Where generated listening audio lives and the URL it is played from. */
@Injectable()
export class AudioStorageService {
  constructor(
    @InjectDisk(AUDIO_DISK) readonly disk: StorageDisk,
    private readonly config: ConfigService<AppEnv, true>,
  ) {}

  get isLocal(): boolean {
    return this.config.get('STORAGE_DRIVER') !== 's3';
  }

  publicUrl(key: string): string {
    return this.isLocal
      ? `/${API_PREFIX}/uploads/audio/${encodeURIComponent(key)}`
      : this.disk.url(key);
  }
}
