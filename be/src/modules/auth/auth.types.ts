import type { PublicUser } from '../users/users.mapper.js';
import type { IssuedRefresh } from '../users/sessions/auth-session.service.js';

/** What the client receives: a short-lived access token and the profile. */
export interface AuthResult {
  accessToken: string;
  user: PublicUser;
}

/** Login and sign-up also open a session; the controller sets its cookie. */
export interface SessionResult extends AuthResult {
  refresh: IssuedRefresh;
}

/** How the new session should behave (plan D22). */
export interface SessionOptions {
  /** "Remember me on this device": 7-day sliding session instead of 12 h. */
  remember: boolean;
  userAgent?: string;
}
