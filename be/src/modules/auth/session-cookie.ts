import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import type { IssuedRefresh } from '../users/sessions/auth-session.service.js';

/**
 * Firebase Hosting forwards only the cookie named `__session` to Cloud Run,
 * so the refresh token must use that name (plan D22).
 */
export const SESSION_COOKIE = '__session';
/** Only the refresh and logout endpoints ever receive the cookie. */
const COOKIE_PATH = '/api/v1/auth'; // API_PREFIX + /auth

/** The value of one cookie from the Cookie header (no cookie-parser needed). */
export function readCookie(req: Request, name: string): string | null {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim()) || null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Whether `origin` may use the session cookie: one of the configured site
 * origins, or a Firebase preview channel of one of them
 * (`https://<site>--<channel>.web.app`, plan D21), which only the project's
 * owners can create.
 */
export function originAllowed(origin: string, allowed: string[]): boolean {
  if (allowed.includes(origin)) return true;
  return allowed.some((a) => {
    const m = /^https:\/\/([a-z0-9-]+)\.web\.app$/.exec(a);
    return (
      m !== null &&
      new RegExp(`^https://${m[1]}--[a-z0-9-]+\\.web\\.app$`).test(origin)
    );
  });
}

/**
 * Sets, clears and guards the refresh cookie. CSRF (plan D22): the cookie is
 * `SameSite=Strict`, only POST endpoints read it, and they also require an
 * `Origin` of the site itself.
 */
@Injectable()
export class SessionCookie {
  private readonly secure: boolean;
  private readonly origins: string[];

  constructor(config: ConfigService) {
    this.secure = config.getOrThrow<boolean>('COOKIE_SECURE');
    // The site can be opened on either Firebase domain (LIVE_CORS_ORIGINS
    // lists both); same-origin requests reach the API through Hosting.
    this.origins = [
      ...config.getOrThrow<string>('CORS_ORIGIN').split(','),
      ...config.getOrThrow<string>('LIVE_CORS_ORIGINS').split(','),
    ]
      .map((o) => o.trim())
      .filter(Boolean);
  }

  read(req: Request): string | null {
    return readCookie(req, SESSION_COOKIE);
  }

  set(res: Response, refresh: IssuedRefresh): void {
    res.cookie(SESSION_COOKIE, refresh.refreshToken, {
      httpOnly: true,
      secure: this.secure,
      sameSite: 'strict',
      path: COOKIE_PATH,
      // No expiry = gone when the browser closes (no "remember me").
      ...(refresh.cookieExpires ? { expires: refresh.cookieExpires } : {}),
    });
    // Responses that set a session must never be cached by Hosting's CDN.
    res.setHeader('Cache-Control', 'private, no-store');
  }

  clear(res: Response): void {
    res.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      secure: this.secure,
      sameSite: 'strict',
      path: COOKIE_PATH,
    });
    res.setHeader('Cache-Control', 'private, no-store');
  }

  /** Refuses cross-site calls of the cookie endpoints. */
  checkOrigin(req: Request): void {
    const origin = req.headers.origin;
    if (origin ? originAllowed(origin, this.origins) : false) return;
    // Some browsers omit Origin on same-origin requests; Fetch Metadata says so.
    if (!origin && req.headers['sec-fetch-site'] === 'same-origin') return;
    throw new ForbiddenException('Yêu cầu không hợp lệ');
  }
}
