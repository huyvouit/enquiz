import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AccountStatus } from '../../common/enums/account-status.enum.js';
import { User } from './schemas/user.schema.js';

const CACHE_MS = 30_000;

/**
 * Account status lookup for every authenticated request. The JWT cannot
 * carry the status (an admin may change it at any time), so it is read from
 * the database and cached briefly. Writers call `invalidate` so a change
 * made in this process applies immediately.
 */
@Injectable()
export class AccountStatusService {
  private readonly cache = new Map<
    string,
    { status: AccountStatus | null; at: number }
  >();

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  /** null when the user no longer exists. */
  async get(userId: string): Promise<AccountStatus | null> {
    const hit = this.cache.get(userId);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.status;
    const user = await this.userModel.findById(userId, { status: 1 }).lean();
    const status = user ? (user.status ?? AccountStatus.ACTIVE) : null;
    this.cache.set(userId, { status, at: Date.now() });
    return status;
  }

  invalidate(userId: string): void {
    this.cache.delete(userId);
  }
}
