import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalDisk, S3Disk, StorageModule } from '@nestjs/storage';
import path from 'node:path';
import type { AppEnv } from '../../config/env.validation.js';
import { IMAGES_DISK, ImageStorageService } from './image-storage.service.js';
import { UploadsController } from './uploads.controller.js';

/**
 * Question images (plan D11). STORAGE_DRIVER=local keeps files under
 * UPLOAD_DIR and serves them from /api/v1/uploads/images/:key;
 * STORAGE_DRIVER=s3 writes to any S3-compatible bucket served at S3_PUBLIC_URL.
 */
@Module({
  imports: [
    StorageModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>) => {
        const images =
          config.get('STORAGE_DRIVER') === 's3'
            ? new S3Disk({
                bucket: config.get('S3_BUCKET'),
                region: config.get('S3_REGION') || undefined,
                endpoint: config.get('S3_ENDPOINT') || undefined,
                prefix: 'images/',
                publicUrl: config.get('S3_PUBLIC_URL'),
              })
            : new LocalDisk({
                root: path.resolve(config.get('UPLOAD_DIR'), 'images'),
              });
        return { disks: { [IMAGES_DISK]: images }, default: IMAGES_DISK };
      },
    }),
  ],
  controllers: [UploadsController],
  providers: [ImageStorageService],
})
export class UploadsModule {}
