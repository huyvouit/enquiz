import { Command } from '@nestjs/cqrs';
import type { SessionOptions, SessionResult } from '../../auth.types.js';

/** Checks the password and opens a login session (plan D22). */
export class LoginCommand extends Command<SessionResult> {
  constructor(
    public readonly username: string,
    public readonly password: string,
    public readonly session: SessionOptions,
  ) {
    super();
  }
}
