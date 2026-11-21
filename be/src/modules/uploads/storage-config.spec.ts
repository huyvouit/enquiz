import type { Bucket } from '@google-cloud/storage';
import { S3Disk } from '@nestjs/storage';
import { validateEnv } from '../../config/env.validation.js';
import { GcsDisk, resolveRange } from './gcs-disk.js';
import { folderUrl } from './uploads.module.js';

const base = { MONGODB_URI: 'mongodb://x/db', JWT_SECRET: 'x'.repeat(32) };

describe('STORAGE_DRIVER=gcs', () => {
  it('needs GCS_BUCKET', () => {
    expect(() => validateEnv({ ...base, STORAGE_DRIVER: 'gcs' })).toThrow(
      /GCS_BUCKET/,
    );
    expect(
      validateEnv({ ...base, STORAGE_DRIVER: 'gcs', GCS_BUCKET: 'b' })
        .GCS_BUCKET,
    ).toBe('b');
  });

  it('rejects an unknown driver', () => {
    expect(() => validateEnv({ ...base, STORAGE_DRIVER: 'ftp' })).toThrow(
      /local, s3 or gcs/,
    );
  });
});

describe('public URLs include the folder', () => {
  it('folderUrl joins base and folder', () => {
    expect(folderUrl('https://storage.googleapis.com/b', 'images')).toBe(
      'https://storage.googleapis.com/b/images/',
    );
    expect(folderUrl('https://cdn.example.com/', 'audio')).toBe(
      'https://cdn.example.com/audio/',
    );
  });

  it('GcsDisk.url points at <bucket>/<folder>/<key>', () => {
    const disk = new GcsDisk({
      bucket: {} as Bucket,
      prefix: 'images/',
      publicUrl: folderUrl('https://storage.googleapis.com/b', 'images'),
    });
    expect(disk.url('a.png')).toBe(
      'https://storage.googleapis.com/b/images/a.png',
    );
  });

  // Regression: S3Disk.url() does not add `prefix`, so the folder has to be
  // in publicUrl, or every image URL misses "images/" and returns 404.
  it('S3Disk.url ignores its prefix', () => {
    const disk = new S3Disk({
      bucket: 'bucket',
      region: 'auto',
      prefix: 'images/',
      publicUrl: folderUrl('https://pub.example.com', 'images'),
      credentials: { accessKeyId: 'a', secretAccessKey: 's' },
    });
    expect(disk.url('a.png')).toBe('https://pub.example.com/images/a.png');
  });
});

describe('resolveRange (same rules as S3)', () => {
  it.each([
    [{ start: 2, end: 4 }, 10, { start: 2, end: 4 }],
    [{ start: 2 }, 10, { start: 2, end: 9 }],
    [{ start: 2, end: 99 }, 10, { start: 2, end: 9 }],
    [{ suffix: 3 }, 10, { start: 7, end: 9 }],
    [{ suffix: 30 }, 10, { start: 0, end: 9 }],
    [{ start: 10 }, 10, undefined],
    [{ suffix: 0 }, 10, undefined],
    [{ start: 0 }, 0, undefined],
  ])('%j of %i bytes → %j', (range, size, expected) => {
    expect(resolveRange(range, size)).toEqual(expected);
  });
});
