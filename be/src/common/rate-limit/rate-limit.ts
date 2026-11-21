import {
  applyDecorators,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthUser } from '../types/auth-user.js';
import { SlidingWindowLimiter } from './sliding-window-limiter.js';

const RATE_LIMIT = 'rateLimit';
const MINUTE = 60_000;

export const TOO_MANY_REQUESTS =
  'Bạn thao tác quá nhanh, vui lòng chờ một phút rồi thử lại';

interface RateLimitRule {
  /** Routes sharing a bucket share one counter. */
  bucket: string;
  limit: number;
}

/**
 * Limits a heavy route per account: `limit` calls per minute (launch A4).
 * The API runs on one Cloud Run instance, so one person clicking "export"
 * in a loop would slow everyone down. Counters live in memory, like the
 * login limits (D14).
 */
export const RateLimit = (bucket: string, limit: number) =>
  applyDecorators(
    SetMetadata(RATE_LIMIT, { bucket, limit } satisfies RateLimitRule),
    UseGuards(RateLimitGuard),
  );

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly limiters = new Map<string, SlidingWindowLimiter>();
  private lastPrune = 0;

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rule = this.reflector.get<RateLimitRule | undefined>(
      RATE_LIMIT,
      context.getHandler(),
    );
    if (!rule) return true;
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    // Global guards ran first, so the user is known; the IP is a fallback.
    const key = req.user ? `u:${req.user.userId}` : `ip:${req.ip}`;
    const limiter = this.limiter(rule);
    if (!limiter.hit(key)) {
      throw new HttpException(TOO_MANY_REQUESTS, HttpStatus.TOO_MANY_REQUESTS);
    }
    return true;
  }

  private limiter({ bucket, limit }: RateLimitRule): SlidingWindowLimiter {
    const now = Date.now();
    if (now - this.lastPrune > MINUTE) {
      this.lastPrune = now;
      for (const l of this.limiters.values()) l.prune(now);
    }
    let limiter = this.limiters.get(bucket);
    if (!limiter) {
      limiter = new SlidingWindowLimiter(limit, MINUTE);
      this.limiters.set(bucket, limiter);
    }
    return limiter;
  }
}
