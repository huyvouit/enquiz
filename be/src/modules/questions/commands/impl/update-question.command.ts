import { Command } from '@nestjs/cqrs';
import type { AuthUser } from '../../../../common/types/auth-user.js';
import type { QuestionDto } from '../../dto/question.dto.js';
import type { QuestionView } from '../../questions.mapper.js';

export class UpdateQuestionCommand extends Command<QuestionView> {
  constructor(
    public readonly id: string,
    public readonly dto: QuestionDto,
    public readonly user: AuthUser,
  ) {
    super();
  }
}
