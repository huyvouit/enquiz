import { Command } from '@nestjs/cqrs';
import type { AuthUser } from '../../../../common/types/auth-user.js';
import type { QuizDto } from '../../dto/quiz.dto.js';
import type { QuizSummary } from '../../quizzes.mapper.js';

export class UpdateQuizCommand extends Command<QuizSummary> {
  constructor(
    public readonly id: string,
    public readonly dto: QuizDto,
    public readonly user: AuthUser,
  ) {
    super();
  }
}
