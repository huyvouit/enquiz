import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AccountStatus } from '../../common/enums/account-status.enum.js';
import type { AuthUser, JwtPayload } from '../../common/types/auth-user.js';
import { AccountStatusService } from '../users/account-status.service.js';
import { AuthSessionService } from '../users/sessions/auth-session.service.js';

/** Thrown to refuse a socket connection; the client sees `connect_error`. */
export class LiveAuthError extends Error {
  constructor(
    /** Machine-readable reason for the client: `unauthorized` | `pending`. */
    readonly code: 'unauthorized' | 'pending',
  ) {
    super(code);
  }
}

/**
 * Socket handshake identity (plan 5, L9). HTTP guards do not run on
 * WebSocket events, so the same checks are made here once per connection:
 * a valid JWT in `handshake.auth.token`, of a session that is still open,
 * and an account that is still active (disabled → refused, pending teacher →
 * refused).
 * No token = anonymous connection (only a guest can join, plan 5.3).
 */
@Injectable()
export class LiveAuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly statuses: AccountStatusService,
    private readonly sessions: AuthSessionService,
  ) {}

  async authenticate(token: unknown): Promise<AuthUser | null> {
    if (token === undefined || token === null || token === '') return null;
    if (typeof token !== 'string') throw new LiveAuthError('unauthorized');

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new LiveAuthError('unauthorized');
    }
    const state = await this.statuses.getState(payload.sub);
    if (state === null || state.status === AccountStatus.DISABLED) {
      throw new LiveAuthError('unauthorized');
    }
    // A token from before the last password change (D20).
    if (!AccountStatusService.tokenStillValid(state, payload.iat)) {
      throw new LiveAuthError('unauthorized');
    }
    // Logged out or revoked session (plan D22).
    if (!(await this.sessions.isActive(payload.sid))) {
      throw new LiveAuthError('unauthorized');
    }
    if (state.status === AccountStatus.PENDING) {
      throw new LiveAuthError('pending');
    }
    return {
      userId: payload.sub,
      username: payload.username,
      role: payload.role,
      issuedAt: payload.iat,
      sessionId: payload.sid,
    };
  }
}

/**
 * The client address as Express would compute it with `trust proxy = hops`
 * (LIVE_TRUST_PROXY, plan D14): count `hops` addresses back from the socket peer
 * through X-Forwarded-For. Socket.io does not apply Express's setting.
 */
export function clientIp(
  peer: string,
  forwardedFor: string | string[] | undefined,
  hops: number,
): string {
  if (hops <= 0) return peer;
  const header = Array.isArray(forwardedFor)
    ? forwardedFor.join(',')
    : (forwardedFor ?? '');
  const chain = [
    ...header
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean),
    peer,
  ];
  return chain[Math.max(chain.length - 1 - hops, 0)];
}
