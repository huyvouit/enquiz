import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from '../../common/types/auth-user.js';
import { AuthSessionService } from '../users/sessions/auth-session.service.js';
import type { PublicUser } from '../users/users.mapper.js';
import type {
  AuthResult,
  SessionOptions,
  SessionResult,
} from './auth.types.js';

/** Issues access tokens and opens sessions. Shared by the auth handlers. */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly sessions: AuthSessionService,
  ) {}

  /** An access token for an existing session (refresh, password change). */
  async issue(user: PublicUser, sessionId: string): Promise<AuthResult> {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      sid: sessionId,
    };
    return { accessToken: await this.jwtService.signAsync(payload), user };
  }

  /** Login and sign-up: a new session, its refresh token and an access token. */
  async startSession(
    user: PublicUser,
    options: SessionOptions,
  ): Promise<SessionResult> {
    const refresh = await this.sessions.create(user.id, options);
    return { ...(await this.issue(user, refresh.sessionId)), refresh };
  }
}
