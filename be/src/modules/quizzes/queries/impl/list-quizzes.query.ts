import { Query } from '@nestjs/cqrs';
import type { AuthUser } from '../../../../common/types/auth-user.js';
import type { Paginated } from '../../../../common/utils/pagination.js';
import type { ListQuizzesDto } from '../../dto/list-quizzes.dto.js';
import type { QuizSummary } from '../../quizzes.mapper.js';

export class ListQuizzesQuery extends Query<Paginated<QuizSummary>> {
  constructor(
    public readonly filters: ListQuizzesDto,
    public readonly user: AuthUser,
  ) {
    super();
  }
}
