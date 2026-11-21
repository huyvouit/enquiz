import { Role } from '../enums/role.enum.js';

/** Shape of `request.user` after JwtStrategy validates the token. */
export interface AuthUser {
  userId: string;
  username: string;
  role: Role;
  /** When the token was issued (JWT `iat`, seconds); see D20. */
  issuedAt?: number;
  /** Login session the token belongs to (plan D22). */
  sessionId?: string;
}

/** Payload signed into the JWT access token. */
export interface JwtPayload {
  sub: string;
  username: string;
  role: Role;
  /** Login session id (plan D22): revoking it ends the token at once. */
  sid?: string;
  /** Set by the JWT library when signing. */
  iat?: number;
}
