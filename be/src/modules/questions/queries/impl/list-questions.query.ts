import { Query } from '@nestjs/cqrs';
import type { AuthUser } from '../../../../common/types/auth-user.js';
import type { Paginated } from '../../../../common/utils/pagination.js';
import type { ListQuestionsDto } from '../../dto/list-questions.dto.js';
import type { QuestionView } from '../../questions.mapper.js';

export class ListQuestionsQuery extends Query<Paginated<QuestionView>> {
  constructor(
    public readonly filters: ListQuestionsDto,
    public readonly user: AuthUser,
  ) {
    super();
  }
}
