import { Query } from '@nestjs/cqrs';
import type { AuthUser } from '../../../../common/types/auth-user.js';
import type { AttemptSummary } from '../../progress.mapper.js';

/** All attempts of one quiz, for the quiz's author (or an admin). */
export class GetQuizResultsQuery extends Query<AttemptSummary[]> {
  constructor(
    public readonly quizId: string,
    public readonly user: AuthUser,
  ) {
    super();
  }
}
