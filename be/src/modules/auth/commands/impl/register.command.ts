import { Command } from '@nestjs/cqrs';
import type { SessionOptions, SessionResult } from '../../auth.types.js';
import type { RegisterDto } from '../../dto/register.dto.js';

export class RegisterCommand extends Command<SessionResult> {
  constructor(
    public readonly dto: RegisterDto,
    public readonly session: SessionOptions,
  ) {
    super();
  }
}
