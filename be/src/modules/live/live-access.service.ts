import { Injectable } from '@nestjs/common';
import type { LiveRoom } from './live-room.registry.js';
import { LiveRoomRegistry } from './live-room.registry.js';
import { SlidingWindowLimiter } from '../../common/rate-limit/sliding-window-limiter.js';

const MINUTE = 60_000;
/** Wrong PINs per key per minute before a one-minute pause (L4). */
export const PIN_FAILURES_PER_MINUTE = 10;
/** Guest join attempts per IP per minute (L11). */
export const GUEST_JOINS_PER_MINUTE = 20;

/**
 * Brute-force and spam limits of the live quiz, shared by the REST PIN
 * lookup and the socket joins. Keys: `u:<userId>` for logged-in users (a
 * whole school shares one IP, students must not block each other),
 * `ip:<address>` for anonymous visitors.
 */
@Injectable()
export class LiveAccessService {
  private readonly pinFailures = new SlidingWindowLimiter(
    PIN_FAILURES_PER_MINUTE,
    MINUTE,
  );
  private readonly guestJoins = new SlidingWindowLimiter(
    GUEST_JOINS_PER_MINUTE,
    MINUTE,
  );
  private lastPrune = 0;

  constructor(private readonly registry: LiveRoomRegistry) {}

  /**
   * The open room behind `pin`, `null` for a wrong PIN (counted), or
   * 'blocked' after too many wrong PINs.
   */
  findRoom(pin: unknown, key: string): LiveRoom | null | 'blocked' {
    this.prune();
    if (!this.pinFailures.allowed(key)) return 'blocked';
    const room =
      typeof pin === 'string' ? this.registry.get(pin.trim()) : undefined;
    if (!room || room.state.phase === 'ended') {
      this.pinFailures.hit(key);
      return null;
    }
    return room;
  }

  /** Counts one guest join attempt from `ip`; false = over the limit. */
  guestJoinAllowed(ip: string): boolean {
    return this.guestJoins.hit(`ip:${ip}`);
  }

  private prune() {
    const now = Date.now();
    if (now - this.lastPrune < MINUTE) return;
    this.lastPrune = now;
    this.pinFailures.prune(now);
    this.guestJoins.prune(now);
  }
}
