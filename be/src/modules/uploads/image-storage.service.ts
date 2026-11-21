import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDisk, StorageDisk } from '@nestjs/storage';
import { API_PREFIX } from '../../common/setup-app.js';
import type { AppEnv } from '../../config/env.validation.js';

export const IMAGES_DISK = 'images';
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const MAX_IMAGE_BYTES = 1024 * 1024;

/** Builds the URL stored in `question.mediaUrl` for an uploaded image. */
@Injectable()
export class ImageStorageService {
  constructor(
    @InjectDisk(IMAGES_DISK) readonly disk: StorageDisk,
    private readonly config: ConfigService<AppEnv, true>,
  ) {}

  get isLocal(): boolean {
    return this.config.get('STORAGE_DRIVER') === 'local';
  }

  /**
   * Local: a path on this API (same origin through the Vite proxy or a
   * reverse proxy). S3 / GCS: the bucket's public URL.
   */
  publicUrl(key: string): string {
    return this.isLocal
      ? `/${API_PREFIX}/uploads/images/${encodeURIComponent(key)}`
      : this.disk.url(key);
  }
}
