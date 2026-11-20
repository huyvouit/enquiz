import { Command } from '@nestjs/cqrs';
import type { AccountStatus } from '../../../../common/enums/account-status.enum.js';
import type { AuthUser } from '../../../../common/types/auth-user.js';
import type { PublicUser } from '../../users.mapper.js';

/** Admin: approve a pending teacher, disable or re-enable an account. */
export class SetUserStatusCommand extends Command<PublicUser> {
  constructor(
    public readonly targetId: string,
    public readonly status: AccountStatus,
    public readonly actor: AuthUser,
  ) {
    super();
  }
}

export interface TemporaryPassword {
  userId: string;
  username: string;
  fullName: string;
  /** Shown once to the person who reset it; never stored in clear or logged. */
  temporaryPassword: string;
}

/**
 * Sets a new random password. Admins: any non-admin account.
 * Teachers: only students in one of their classes.
 */
export class ResetPasswordCommand extends Command<TemporaryPassword> {
  constructor(
    public readonly targetId: string,
    public readonly actor: AuthUser,
  ) {
    super();
  }
}
