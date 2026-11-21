import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { createHash, randomBytes } from 'node:crypto';
import { parseDuration } from '../../../common/utils/duration.js';
import { AuthSession } from './auth-session.schema.js';

const CACHE_MS = 30_000;
/**
 * A replaced token that comes back this soon is a race (two tabs, a lost
 * response), not a theft: refuse it without ending the session.
 */
const REPLAY_GRACE_MS = 30_000;

export const SESSION_EXPIRED =
  'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại';

export interface IssuedRefresh {
  sessionId: string;
  userId: string;
  /** The raw token for the cookie. Only its hash is stored. */
  refreshToken: string;
  /** Cookie expiry; null = a browser-session cookie (no "remember me"). */
  cookieExpires: Date | null;
}

const hash = (token: string) =>
  createHash('sha256').update(token).digest('hex');
const newToken = () => randomBytes(32).toString('base64url');

/**
 * Login sessions behind the refresh cookie (plan D22): create, rotate,
 * revoke. Access tokens carry the session id; `isActive` lets the guards
 * refuse them as soon as the session is revoked (cached briefly, and
 * cleared here on revoke, since the API runs as a single instance).
 */
@Injectable()
export class AuthSessionService {
  private readonly ttlSession: number;
  private readonly ttlRemember: number;
  private readonly maxRemember: number;
  private readonly cache = new Map<
    string,
    { active: boolean; userId: string | null; at: number }
  >();

  constructor(
    @InjectModel(AuthSession.name)
    private readonly sessions: Model<AuthSession>,
    config: ConfigService,
  ) {
    this.ttlSession = parseDuration(config.getOrThrow('REFRESH_TTL_SESSION'));
    this.ttlRemember = parseDuration(config.getOrThrow('REFRESH_TTL_REMEMBER'));
    this.maxRemember = parseDuration(config.getOrThrow('REFRESH_MAX_REMEMBER'));
  }

  async create(
    userId: string,
    options: { remember: boolean; userAgent?: string },
  ): Promise<IssuedRefresh> {
    const now = Date.now();
    const maxExpiresAt = new Date(
      now + (options.remember ? this.maxRemember : this.ttlSession),
    );
    const expiresAt = options.remember
      ? new Date(now + this.ttlRemember)
      : maxExpiresAt;
    const refreshToken = newToken();
    const created = await this.sessions.create({
      userId: new Types.ObjectId(userId),
      tokenHash: hash(refreshToken),
      remember: options.remember,
      expiresAt,
      maxExpiresAt,
      lastUsedAt: new Date(now),
      userAgent: options.userAgent?.slice(0, 120),
    });
    return {
      sessionId: created._id.toString(),
      userId,
      refreshToken,
      cookieExpires: options.remember ? expiresAt : null,
    };
  }

  /**
   * Swaps a refresh token for a new one. An unknown or expired token → 401.
   * A token that was already replaced → 401, and the whole session is
   * revoked unless that happened within the last few seconds (a race).
   */
  async rotate(refreshToken: string): Promise<IssuedRefresh> {
    const now = new Date();
    const oldHash = hash(refreshToken);
    const current = await this.sessions
      .findOne({ tokenHash: oldHash, expiresAt: { $gt: now } })
      .lean();

    if (!current) {
      const replaced = await this.sessions
        .findOne({ prevHash: oldHash }, { rotatedAt: 1 })
        .lean();
      const age = now.getTime() - (replaced?.rotatedAt?.getTime() ?? 0);
      if (replaced && age > REPLAY_GRACE_MS) {
        await this.revoke(replaced._id.toString());
      }
      throw new UnauthorizedException(SESSION_EXPIRED);
    }

    const expiresAt = current.remember
      ? new Date(
          Math.min(
            now.getTime() + this.ttlRemember,
            current.maxExpiresAt.getTime(),
          ),
        )
      : current.expiresAt;
    const next = newToken();
    // Conditional on the old hash: of two concurrent refreshes, one wins.
    const updated = await this.sessions.updateOne(
      { _id: current._id, tokenHash: oldHash },
      {
        tokenHash: hash(next),
        prevHash: oldHash,
        rotatedAt: now,
        lastUsedAt: now,
        expiresAt,
      },
    );
    if (updated.modifiedCount !== 1) {
      throw new UnauthorizedException(SESSION_EXPIRED);
    }
    return {
      sessionId: current._id.toString(),
      userId: current.userId.toString(),
      refreshToken: next,
      cookieExpires: current.remember ? expiresAt : null,
    };
  }

  /** Whether access tokens of this session are still honoured. */
  async isActive(sessionId: string | undefined): Promise<boolean> {
    if (!sessionId || !Types.ObjectId.isValid(sessionId)) return false;
    const hit = this.cache.get(sessionId);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.active;
    const found = await this.sessions
      .findOne(
        { _id: sessionId, expiresAt: { $gt: new Date() } },
        { userId: 1 },
      )
      .lean();
    this.cache.set(sessionId, {
      active: found !== null,
      userId: found?.userId.toString() ?? null,
      at: Date.now(),
    });
    return found !== null;
  }

  async revoke(sessionId: string): Promise<void> {
    if (!Types.ObjectId.isValid(sessionId)) return;
    await this.sessions.deleteOne({ _id: sessionId });
    this.cache.delete(sessionId);
  }

  /** Logout: ends the session of this refresh token, if any. */
  async revokeByToken(refreshToken: string): Promise<void> {
    const found = await this.sessions
      .findOne({ tokenHash: hash(refreshToken) }, { _id: 1 })
      .lean();
    if (found) await this.revoke(found._id.toString());
  }

  /**
   * Every session of a user, except `keepSessionId` (the device that changed
   * its own password stays logged in). Used on password change or reset, a
   * disabled account, and "log out everywhere".
   */
  async revokeAll(userId: string, keepSessionId?: string): Promise<number> {
    const filter: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
    };
    if (keepSessionId && Types.ObjectId.isValid(keepSessionId)) {
      filter._id = { $ne: new Types.ObjectId(keepSessionId) };
    }
    const { deletedCount } = await this.sessions.deleteMany(filter);
    for (const [sid, entry] of this.cache) {
      if (entry.userId === userId && sid !== keepSessionId) {
        this.cache.delete(sid);
      }
    }
    return deletedCount;
  }
}
