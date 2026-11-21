import { Storage as GcsClient } from '@google-cloud/storage';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LocalDisk,
  S3Disk,
  type StorageDisk,
  StorageModule,
} from '@nestjs/storage';
import path from 'node:path';
import type { AppEnv } from '../../config/env.validation.js';
import { AUDIO_DISK, AudioStorageService } from './audio-storage.js';
import { GcsDisk } from './gcs-disk.js';
import { IMAGES_DISK, ImageStorageService } from './image-storage.service.js';
import { UploadsController } from './uploads.controller.js';

/** "https://host/bucket" + "images" -> "https://host/bucket/images/". */
export const folderUrl = (base: string, folder: string): string =>
  `${base.replace(/\/+$/, '')}/${folder}/`;

/**
 * Question images (plan D11) and listening audio (plan D16), one disk each.
 * - `local`: files under UPLOAD_DIR/<folder>, served by /api/v1/uploads/<folder>/:key.
 * - `s3`: any S3-compatible bucket under <folder>/, served from S3_PUBLIC_URL.
 * - `gcs`: Cloud Storage under <folder>/ with the app's own identity (no
 *   keys), served from https://storage.googleapis.com/<GCS_BUCKET>.
 */
@Module({
  imports: [
    StorageModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>) => {
        const driver = config.get('STORAGE_DRIVER');
        const gcsBucket =
          driver === 'gcs'
            ? new GcsClient().bucket(config.get('GCS_BUCKET'))
            : undefined;
        const disk = (folder: string): StorageDisk => {
          if (gcsBucket) {
            return new GcsDisk({
              bucket: gcsBucket,
              prefix: `${folder}/`,
              publicUrl: folderUrl(
                `https://storage.googleapis.com/${gcsBucket.name}`,
                folder,
              ),
            });
          }
          if (driver === 's3') {
            return new S3Disk({
              bucket: config.get('S3_BUCKET'),
              region: config.get('S3_REGION') || undefined,
              endpoint: config.get('S3_ENDPOINT') || undefined,
              prefix: `${folder}/`,
              // url() does not add the prefix: the folder is part of the base.
              publicUrl: folderUrl(config.get('S3_PUBLIC_URL'), folder),
            });
          }
          return new LocalDisk({
            root: path.resolve(config.get('UPLOAD_DIR'), folder),
          });
        };
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
