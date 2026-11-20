import { Command } from '@nestjs/cqrs';
import type { AuthResult } from '../../auth.types.js';
import type { RegisterDto } from '../../dto/register.dto.js';

export class RegisterCommand extends Command<AuthResult> {
  constructor(public readonly dto: RegisterDto) {
    super();
  }
}
