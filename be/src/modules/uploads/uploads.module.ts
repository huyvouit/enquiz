import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalDisk, S3Disk, StorageModule } from '@nestjs/storage';
import path from 'node:path';
import type { AppEnv } from '../../config/env.validation.js';
import { AUDIO_DISK, AudioStorageService } from './audio-storage.js';
import { IMAGES_DISK, ImageStorageService } from './image-storage.service.js';
import { UploadsController } from './uploads.controller.js';

/**
 * Question images (plan D11) and listening audio (plan D16), one disk each.
 * STORAGE_DRIVER=local keeps files under UPLOAD_DIR/<folder> and serves them
 * from /api/v1/uploads/<folder>/:key; STORAGE_DRIVER=s3 writes to any
 * S3-compatible bucket under <folder>/ and serves them from S3_PUBLIC_URL.
 */
@Module({
  imports: [
    StorageModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>) => {
        const disk = (folder: string) =>
          config.get('STORAGE_DRIVER') === 's3'
            ? new S3Disk({
                bucket: config.get('S3_BUCKET'),
                region: config.get('S3_REGION') || undefined,
                endpoint: config.get('S3_ENDPOINT') || undefined,
                prefix: `${folder}/`,
                publicUrl: config.get('S3_PUBLIC_URL'),
              })
            : new LocalDisk({
                root: path.resolve(config.get('UPLOAD_DIR'), folder),
              });
        return {
          disks: { [IMAGES_DISK]: disk('images'), [AUDIO_DISK]: disk('audio') },
          default: IMAGES_DISK,
        };
      },
    }),
  ],
  controllers: [UploadsController],
  providers: [ImageStorageService, AudioStorageService],
  exports: [AudioStorageService],
})
export class UploadsModule {}
