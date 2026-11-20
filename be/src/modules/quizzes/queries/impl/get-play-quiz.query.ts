import { Query } from '@nestjs/cqrs';
import type { AuthUser } from '../../../../common/types/auth-user.js';
import type { PlayQuiz } from '../../quizzes.mapper.js';

/** Student view used by the game screen. Never contains answer keys. */
export class GetPlayQuizQuery extends Query<PlayQuiz> {
  constructor(
    public readonly id: string,
    public readonly user: AuthUser,
  ) {
    super();
  }
}
