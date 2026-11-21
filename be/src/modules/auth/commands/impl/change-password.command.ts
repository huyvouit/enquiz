import { Command } from '@nestjs/cqrs';
import type { AuthUser } from '../../../../common/types/auth-user.js';
import type { AuthResult } from '../../auth.types.js';

/** The user changes their own password (plan D20); returns a fresh token. */
export class ChangePasswordCommand extends Command<AuthResult> {
  constructor(
    public readonly user: AuthUser,
    public readonly currentPassword: string,
    public readonly newPassword: string,
  ) {
    super();
  }
}
