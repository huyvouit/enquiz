import { parseDuration } from '../common/utils/duration.js';

/**
 * Environment variables are validated once at startup so the app fails fast
 * with a clear message instead of failing later at runtime.
 */
export interface AppEnv {
  PORT: number;
  /** A MongoDB connection string, or the literal `memory` for an in-memory dev DB. */
  MONGODB_URI: string;
  JWT_SECRET: string;
  /** Access token lifetime (plan D22): short, refreshed from the session cookie. */
  JWT_EXPIRES_IN: string;
  /**
   * Refresh sessions (plan D22). Without "remember me": a browser-session
   * cookie, at most REFRESH_TTL_SESSION. With it: REFRESH_TTL_REMEMBER since
   * the last use, never more than REFRESH_MAX_REMEMBER after the login.
   */
  REFRESH_TTL_SESSION: string;
  REFRESH_TTL_REMEMBER: string;
  REFRESH_MAX_REMEMBER: string;
  /**
   * `Secure` attribute of the session cookie. Browsers accept Secure cookies
   * on http://localhost, so only turn it off for a plain-http test host.
   */
  COOKIE_SECURE: boolean;
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
  /**
   * Same, for the live quiz socket, which reaches Cloud Run directly (D19)
   * while HTTP goes through Firebase Hosting: one proxy fewer. Trusting too
   * many lets a client fake its IP with X-Forwarded-For. Default: TRUST_PROXY.
   */
  LIVE_TRUST_PROXY: number;
  /**
   * Release shown by /health (plan D21): set per Cloud Run revision by
   * scripts/release.sh from the repo's VERSION file and git commit.
   */
  APP_VERSION: string;
  GIT_COMMIT: string;
  /**
   * Where question images and listening audio go: `local` disk, an
   * S3-compatible bucket (`s3`, needs keys) or Cloud Storage signed in as the
   * service account the app runs as (`gcs`, no keys; plan D18).
   */
  STORAGE_DRIVER: 'local' | 's3' | 'gcs';
  /** Local driver: folder for uploads (relative to the working directory). */
  UPLOAD_DIR: string;
  S3_BUCKET: string;
  S3_REGION: string;
  S3_ENDPOINT: string;
  /** Public base URL of the bucket (files are under images/ and audio/). */
  S3_PUBLIC_URL: string;
  /** `gcs`: bucket name; files are public at storage.googleapis.com/<bucket>. */
  GCS_BUCKET: string;
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
    JWT_EXPIRES_IN: str('JWT_EXPIRES_IN', '15m'),
    REFRESH_TTL_SESSION: str('REFRESH_TTL_SESSION', '12h'),
    REFRESH_TTL_REMEMBER: str('REFRESH_TTL_REMEMBER', '7d'),
    REFRESH_MAX_REMEMBER: str('REFRESH_MAX_REMEMBER', '14d'),
    COOKIE_SECURE: str('COOKIE_SECURE', 'true') !== 'false',
    CORS_ORIGIN: str('CORS_ORIGIN', 'http://localhost:5173'),
    LIVE_CORS_ORIGINS: str('LIVE_CORS_ORIGINS', 'http://localhost:5173'),
    SEED_DEMO_DATA: str('SEED_DEMO_DATA', 'false') === 'true',
    AUTH_RATE_LIMIT: Number(str('AUTH_RATE_LIMIT', '10')),
    AUTH_IP_RATE_LIMIT: Number(str('AUTH_IP_RATE_LIMIT', '100')),
    TRUST_PROXY: Number(str('TRUST_PROXY', '0')),
    LIVE_TRUST_PROXY: Number(str('LIVE_TRUST_PROXY', str('TRUST_PROXY', '0'))),
    APP_VERSION: str('APP_VERSION', 'dev'),
    GIT_COMMIT: str('GIT_COMMIT', 'unknown'),
    STORAGE_DRIVER: str('STORAGE_DRIVER', 'local') as AppEnv['STORAGE_DRIVER'],
    UPLOAD_DIR: str('UPLOAD_DIR', 'uploads'),
    S3_BUCKET: str('S3_BUCKET', ''),
    S3_REGION: str('S3_REGION', ''),
    S3_ENDPOINT: str('S3_ENDPOINT', ''),
    S3_PUBLIC_URL: str('S3_PUBLIC_URL', ''),
    GCS_BUCKET: str('GCS_BUCKET', ''),
    TTS_DRIVER: str('TTS_DRIVER', 'none') as AppEnv['TTS_DRIVER'],
    GOOGLE_TTS_API_KEY: str('GOOGLE_TTS_API_KEY', ''),
    TTS_LANGUAGE: str('TTS_LANGUAGE', 'en-GB'),
    TTS_VOICE: str('TTS_VOICE', ''),
  };

  if (Number.isNaN(env.PORT)) errors.push('PORT must be a number');
  if (!['local', 's3', 'gcs'].includes(env.STORAGE_DRIVER)) {
    errors.push('STORAGE_DRIVER must be local, s3 or gcs');
  }
  if (env.STORAGE_DRIVER === 's3' && (!env.S3_BUCKET || !env.S3_PUBLIC_URL)) {
    errors.push(
      'S3_BUCKET and S3_PUBLIC_URL are required when STORAGE_DRIVER=s3',
    );
  }
  if (env.STORAGE_DRIVER === 'gcs' && !env.GCS_BUCKET) {
    errors.push('GCS_BUCKET is required when STORAGE_DRIVER=gcs');
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
  if (!Number.isInteger(env.LIVE_TRUST_PROXY) || env.LIVE_TRUST_PROXY < 0) {
    errors.push('LIVE_TRUST_PROXY must be 0 or a positive integer');
  }
  if (!Number.isInteger(env.TRUST_PROXY) || env.TRUST_PROXY < 0) {
    errors.push('TRUST_PROXY must be 0 or a positive integer');
  }
  for (const key of [
    'JWT_EXPIRES_IN',
    'REFRESH_TTL_SESSION',
    'REFRESH_TTL_REMEMBER',
    'REFRESH_MAX_REMEMBER',
  ] as const) {
    if (!(parseDuration(env[key]) > 0)) {
      errors.push(`${key} must look like 15m, 12h or 7d`);
    }
  }
  if (
    parseDuration(env.REFRESH_MAX_REMEMBER) <
    parseDuration(env.REFRESH_TTL_REMEMBER)
  ) {
    errors.push(
      'REFRESH_MAX_REMEMBER must not be shorter than REFRESH_TTL_REMEMBER',
    );
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
