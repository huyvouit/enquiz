import { Query } from '@nestjs/cqrs';
import type { AuthUser } from '../../../../common/types/auth-user.js';
import type { QuizDetail } from '../../quizzes.mapper.js';

/** Teacher/admin view including answer keys. */
export class GetQuizDetailQuery extends Query<QuizDetail> {
  constructor(
    public readonly id: string,
    public readonly user: AuthUser,
  ) {
    super();
  }
}
