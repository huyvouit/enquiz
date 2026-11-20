import { Command } from '@nestjs/cqrs';
import type { AuthUser } from '../../../../common/types/auth-user.js';

export class DeleteQuestionCommand extends Command<{ id: string }> {
  constructor(
    public readonly id: string,
    public readonly user: AuthUser,
  ) {
    super();
  }
}
