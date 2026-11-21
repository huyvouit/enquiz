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
  /**
   * Origins allowed to open the live quiz socket (plan 5, D19), comma
   * separated. The socket goes straight to Cloud Run, so the Firebase domain
   * must be listed.
   */
  LIVE_CORS_ORIGINS: string;
  SEED_DEMO_DATA: boolean;
  /** Login/register attempts allowed per username per minute. */
  AUTH_RATE_LIMIT: number;
  /** Login/register requests allowed per IP per minute (a school shares one IP). */
  AUTH_IP_RATE_LIMIT: number;
  /**
   * Number of reverse proxies in front of the app (Express `trust proxy`), so
   * `req.ip` is the real client. 0 = connected directly (local dev).
   */
  TRUST_PROXY: number;
  /** Where uploaded question images go: `local` disk or an S3-compatible bucket. */
  STORAGE_DRIVER: 'local' | 's3';
  /** Local driver: folder for uploads (relative to the working directory). */
  UPLOAD_DIR: string;
  S3_BUCKET: string;
  S3_REGION: string;
  S3_ENDPOINT: string;
  /** Public base URL the bucket's images are served from. */
  S3_PUBLIC_URL: string;
  /**
   * Text-to-speech for listening questions (plan D16): `google` (Cloud
   * Text-to-Speech), `none` (no audio is made; questions show "no audio yet")
   * or `fake` (tests only).
   */
  TTS_DRIVER: 'none' | 'google' | 'fake';
  /** API key restricted to the Text-to-Speech API. Required for `google`. */
  GOOGLE_TTS_API_KEY: string;
  /** BCP-47 language of the voice, e.g. en-GB (Cambridge YLE) or en-US. */
  TTS_LANGUAGE: string;
  /** Optional exact voice name, e.g. en-GB-Standard-A; empty = API default. */
  TTS_VOICE: string;
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
    LIVE_CORS_ORIGINS: str('LIVE_CORS_ORIGINS', 'http://localhost:5173'),
    SEED_DEMO_DATA: str('SEED_DEMO_DATA', 'false') === 'true',
    AUTH_RATE_LIMIT: Number(str('AUTH_RATE_LIMIT', '10')),
    AUTH_IP_RATE_LIMIT: Number(str('AUTH_IP_RATE_LIMIT', '100')),
    TRUST_PROXY: Number(str('TRUST_PROXY', '0')),
    STORAGE_DRIVER: str('STORAGE_DRIVER', 'local') as AppEnv['STORAGE_DRIVER'],
    UPLOAD_DIR: str('UPLOAD_DIR', 'uploads'),
    S3_BUCKET: str('S3_BUCKET', ''),
    S3_REGION: str('S3_REGION', ''),
    S3_ENDPOINT: str('S3_ENDPOINT', ''),
    S3_PUBLIC_URL: str('S3_PUBLIC_URL', ''),
    TTS_DRIVER: str('TTS_DRIVER', 'none') as AppEnv['TTS_DRIVER'],
    GOOGLE_TTS_API_KEY: str('GOOGLE_TTS_API_KEY', ''),
    TTS_LANGUAGE: str('TTS_LANGUAGE', 'en-GB'),
    TTS_VOICE: str('TTS_VOICE', ''),
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
  if (!['none', 'google', 'fake'].includes(env.TTS_DRIVER)) {
    errors.push('TTS_DRIVER must be none, google or fake');
  }
  if (env.TTS_DRIVER === 'google' && !env.GOOGLE_TTS_API_KEY) {
    errors.push('GOOGLE_TTS_API_KEY is required when TTS_DRIVER=google');
  }
  if (!/^[a-z]{2,3}-[A-Z]{2}$/.test(env.TTS_LANGUAGE)) {
    errors.push('TTS_LANGUAGE must look like en-GB');
  }
  for (const key of ['AUTH_RATE_LIMIT', 'AUTH_IP_RATE_LIMIT'] as const) {
    if (!Number.isInteger(env[key]) || env[key] < 1) {
      errors.push(`${key} must be a positive integer`);
    }
  }
  if (!Number.isInteger(env.TRUST_PROXY) || env.TRUST_PROXY < 0) {
    errors.push('TRUST_PROXY must be 0 or a positive integer');
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
