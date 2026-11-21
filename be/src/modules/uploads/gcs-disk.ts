import type { Bucket, File } from '@google-cloud/storage';
import {
  StorageDisk,
  StorageFileNotFoundError,
  StorageRangeNotSatisfiableError,
  type StorageDownload,
  type StorageFile,
  type StorageListPage,
  type StorageObjectWrite,
  type StorageRange,
  type StorageSignalOptions,
  type StorageWriteResult,
} from '@nestjs/storage';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export interface GcsDiskOptions {
  /** A bucket handle: `new Storage().bucket(name)` (credentials from ADC). */
  bucket: Bucket;
  /** Folder inside the bucket, such as "images/". */
  prefix?: string;
  /** Public base URL of the files under `prefix`. Enables `url()`. */
  publicUrl?: string;
}

/** The object metadata fields this disk reads (a subset of GCS's resource). */
interface GcsMetadata {
  size?: string | number;
  contentType?: string;
  updated?: string;
  md5Hash?: string;
  generation?: string | number;
  cacheControl?: string;
  contentDisposition?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Cloud Storage through its JSON API, signed in as whoever runs the app
 * (Application Default Credentials: the Cloud Run service account), so no
 * key is ever created or stored (plan D18; the org blocks service account
 * keys, which S3Disk needs as HMAC keys). One upload is one request, so a
 * reader sees the old object or the new one, never part of it.
 */
export class GcsDisk extends StorageDisk {
  private readonly bucket: Bucket;
  private readonly prefix: string;

  constructor(options: GcsDiskOptions) {
    super({ publicUrl: options.publicUrl });
    this.bucket = options.bucket;
    this.prefix = options.prefix ?? '';
  }

  protected async writeObject(
    key: string,
    body: AsyncIterable<Buffer>,
    file: StorageObjectWrite,
  ): Promise<StorageWriteResult> {
    const target = this.file(key);
    await pipeline(
      Readable.from(body),
      target.createWriteStream({
        resumable: false,
        contentType: file.contentType,
        metadata: {
          cacheControl: file.cacheControl,
          contentDisposition: file.contentDisposition,
          metadata: file.metadata,
        },
      }),
      { signal: file.signal },
    );
    const meta = (target.metadata as GcsMetadata).size
      ? (target.metadata as GcsMetadata)
      : await this.metadata(target, key);
    const stored = toFile(key, meta);
    return {
      key,
      size: stored.size,
      contentType: stored.contentType,
      etag: stored.etag,
    };
  }

  protected async readObject(
    key: string,
    range: StorageRange | undefined,
    options?: StorageSignalOptions,
  ): Promise<StorageDownload> {
    const target = this.file(key);
    const stored = toFile(key, await this.metadata(target, key));
    const resolved = range ? resolveRange(range, stored.size) : undefined;
    if (range && !resolved) {
      throw new StorageRangeNotSatisfiableError(key, stored.size);
    }
    // A ranged read can't be checked against the whole file's hash.
    const body = target.createReadStream(
      resolved
        ? { start: resolved.start, end: resolved.end, validation: false }
        : {},
    );
    options?.signal?.addEventListener(
      'abort',
      () => body.destroy(options.signal?.reason as Error),
      { once: true },
    );
    return { ...stored, body, ...(resolved ? { range: resolved } : {}) };
  }

  protected async headObject(key: string): Promise<StorageFile> {
    return toFile(key, await this.metadata(this.file(key), key));
  }

  protected async deleteObjects(keys: string[]): Promise<void> {
    await Promise.all(
      keys.map((key) => this.file(key).delete({ ignoreNotFound: true })),
    );
  }

  protected async listObjects(options: {
    prefix: string;
    cursor?: string;
    limit: number;
  }): Promise<StorageListPage> {
    const [files, next] = await this.bucket.getFiles({
      prefix: this.prefix + options.prefix,
      maxResults: options.limit,
      pageToken: options.cursor,
      autoPaginate: false,
    });
    return {
      entries: files.map((f) => {
        const stored = toFile(
          f.name.slice(this.prefix.length),
          f.metadata as GcsMetadata,
        );
        return {
          key: stored.key,
          size: stored.size,
          lastModified: stored.lastModified,
          etag: stored.etag,
        };
      }),
      cursor: (next as { pageToken?: string } | null)?.pageToken,
    };
  }

  protected async copyObject(
    from: string,
    to: string,
  ): Promise<StorageWriteResult> {
    try {
      const [copy] = await this.file(from).copy(this.file(to));
      const stored = toFile(to, await this.metadata(copy, to));
      return {
        key: to,
        size: stored.size,
        contentType: stored.contentType,
        etag: stored.etag,
      };
    } catch (err) {
      throw isNotFound(err) ? new StorageFileNotFoundError(from) : err;
    }
  }

  private file(key: string): File {
    return this.bucket.file(this.prefix + key);
  }

  private async metadata(target: File, key: string): Promise<GcsMetadata> {
    try {
      const [meta] = await target.getMetadata();
      return meta as GcsMetadata;
    } catch (err) {
      throw isNotFound(err) ? new StorageFileNotFoundError(key) : err;
    }
  }
}

function isNotFound(err: unknown): boolean {
  return (err as { code?: unknown } | null)?.code === 404;
}

function toFile(key: string, meta: GcsMetadata): StorageFile {
  const md5 = meta.md5Hash
    ? Buffer.from(meta.md5Hash, 'base64').toString('hex')
    : meta.generation;
  return {
    key,
    size: Number(meta.size ?? 0),
    contentType: meta.contentType ?? 'application/octet-stream',
    lastModified: meta.updated ? new Date(meta.updated) : new Date(0),
    etag: md5 === undefined ? undefined : `"${md5}"`,
    cacheControl: meta.cacheControl,
    contentDisposition: meta.contentDisposition,
    metadata: Object.fromEntries(
      Object.entries(meta.metadata ?? {}).map(([k, v]) => [
        k.toLowerCase(),
        String(v),
      ]),
    ),
  };
}

/** Same rules as the other disks (S3's): see `resolveRange` in @nestjs/storage. */
export function resolveRange(
  range: StorageRange,
  size: number,
): { start: number; end: number } | undefined {
  if (size === 0) return undefined;
  if ('suffix' in range) {
    if (range.suffix <= 0) return undefined;
    return { start: Math.max(0, size - range.suffix), end: size - 1 };
  }
  if (range.start >= size) return undefined;
  return {
    start: range.start,
    end: Math.min(range.end ?? size - 1, size - 1),
  };
}
