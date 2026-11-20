import { Command } from '@nestjs/cqrs';
import type { AuthResult } from '../../auth.types.js';

/**
 * Login does not change state, but it is modelled as a command because it is
 * an action with side effects in the future (last-login, audit, lockout).
 */
export class LoginCommand extends Command<AuthResult> {
  constructor(
    public readonly username: string,
    public readonly password: string,
  ) {
    super();
  }
}
