/**
 * Environment variables are validated once at startup so the app fails fast
 * with a clear message instead of failing later at runtime.
 */
export interface AppEnv {
  PORT: number;
  /** A MongoDB connection string, or the literal `memory` for an in-memory dev DB. */
  MONGODB_URI: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  CORS_ORIGIN: string;
  SEED_DEMO_DATA: boolean;
  /** Login/register attempts allowed per IP per minute. */
  AUTH_RATE_LIMIT: number;
  /** Where uploaded question images go: `local` disk or an S3-compatible bucket. */
  STORAGE_DRIVER: 'local' | 's3';
  /** Local driver: folder for uploads (relative to the working directory). */
  UPLOAD_DIR: string;
  S3_BUCKET: string;
  S3_REGION: string;
  S3_ENDPOINT: string;
  /** Public base URL the bucket's images are served from. */
  S3_PUBLIC_URL: string;
}

export function validateEnv(raw: Record<string, unknown>): AppEnv {
  const errors: string[] = [];
  const str = (key: string, fallback?: string): string => {
    const value = raw[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
    if (fallback !== undefined) return fallback;
    errors.push(`${key} is required`);
    return '';
  };

  const env: AppEnv = {
    PORT: Number(str('PORT', '3000')),
    MONGODB_URI: str('MONGODB_URI'),
    JWT_SECRET: str('JWT_SECRET'),
    JWT_EXPIRES_IN: str('JWT_EXPIRES_IN', '7d'),
    CORS_ORIGIN: str('CORS_ORIGIN', 'http://localhost:5173'),
    SEED_DEMO_DATA: str('SEED_DEMO_DATA', 'false') === 'true',
    AUTH_RATE_LIMIT: Number(str('AUTH_RATE_LIMIT', '10')),
    STORAGE_DRIVER: str('STORAGE_DRIVER', 'local') as AppEnv['STORAGE_DRIVER'],
    UPLOAD_DIR: str('UPLOAD_DIR', 'uploads'),
    S3_BUCKET: str('S3_BUCKET', ''),
    S3_REGION: str('S3_REGION', ''),
    S3_ENDPOINT: str('S3_ENDPOINT', ''),
    S3_PUBLIC_URL: str('S3_PUBLIC_URL', ''),
  };

  if (Number.isNaN(env.PORT)) errors.push('PORT must be a number');
  if (env.STORAGE_DRIVER !== 'local' && env.STORAGE_DRIVER !== 's3') {
    errors.push('STORAGE_DRIVER must be local or s3');
  }
  if (env.STORAGE_DRIVER === 's3' && (!env.S3_BUCKET || !env.S3_PUBLIC_URL)) {
    errors.push(
      'S3_BUCKET and S3_PUBLIC_URL are required when STORAGE_DRIVER=s3',
    );
  }
  if (!Number.isInteger(env.AUTH_RATE_LIMIT) || env.AUTH_RATE_LIMIT < 1) {
    errors.push('AUTH_RATE_LIMIT must be a positive integer');
  }
  if (env.JWT_SECRET && env.JWT_SECRET.length < 16) {
    errors.push('JWT_SECRET must be at least 16 characters');
  }
  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n- ${errors.join('\n- ')}`,
    );
  }
  return env;
}
