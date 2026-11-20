import { Query } from '@nestjs/cqrs';
import type { AuthUser } from '../../../../common/types/auth-user.js';
import type { AttemptResult } from '../../progress.mapper.js';

export class GetAttemptQuery extends Query<AttemptResult> {
  constructor(
    public readonly attemptId: string,
    public readonly user: AuthUser,
  ) {
    super();
  }
}
