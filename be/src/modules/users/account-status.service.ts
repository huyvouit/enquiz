import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AccountStatus } from '../../common/enums/account-status.enum.js';
import { User } from './schemas/user.schema.js';

const CACHE_MS = 30_000;

export interface AccountState {
  status: AccountStatus;
  /** Seconds since the epoch, or null when the password was never changed. */
  passwordChangedAt: number | null;
}

/** Whole seconds, the unit of a JWT's `iat` (plan D20). */
export const toEpochSeconds = (date: Date): number =>
  Math.floor(date.getTime() / 1000);

/** A password change stamp: now, truncated to the second like `iat`. */
export const passwordChangeStamp = (): Date =>
  new Date(toEpochSeconds(new Date()) * 1000);

/**
 * Account status lookup for every authenticated request. The JWT cannot
 * carry the status (an admin may change it at any time), so it is read from
 * the database and cached briefly, together with the last password change
 * (D20). Writers call `invalidate` so a change made in this process applies
 * immediately.
 */
@Injectable()
export class AccountStatusService {
  private readonly cache = new Map<
    string,
    { state: AccountState | null; at: number }
  >();

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  /** null when the user no longer exists. */
  async get(userId: string): Promise<AccountStatus | null> {
    return (await this.getState(userId))?.status ?? null;
  }

  /** null when the user no longer exists. */
  async getState(userId: string): Promise<AccountState | null> {
    const hit = this.cache.get(userId);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.state;
    const user = await this.userModel
      .findById(userId, { status: 1, passwordChangedAt: 1 })
      .lean();
    const state = user
      ? {
          status: user.status ?? AccountStatus.ACTIVE,
          passwordChangedAt: user.passwordChangedAt
            ? toEpochSeconds(user.passwordChangedAt)
            : null,
        }
      : null;
    this.cache.set(userId, { state, at: Date.now() });
    return state;
  }

  /**
   * False when the token was issued before the last password change, i.e.
   * on another device that must log in again (D20).
   */
  static tokenStillValid(
    state: AccountState,
    issuedAt: number | undefined,
  ): boolean {
    if (state.passwordChangedAt === null || issuedAt === undefined) {
      return true;
    }
    return issuedAt >= state.passwordChangedAt;
  }

  invalidate(userId: string): void {
    this.cache.delete(userId);
  }
}
