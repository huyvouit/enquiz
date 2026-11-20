import { Command } from '@nestjs/cqrs';
import type { AuthUser } from '../../../../common/types/auth-user.js';
import type { QuizDto } from '../../dto/quiz.dto.js';
import type { QuizSummary } from '../../quizzes.mapper.js';

export class CreateQuizCommand extends Command<QuizSummary> {
  constructor(
    public readonly dto: QuizDto,
    public readonly user: AuthUser,
  ) {
    super();
  }
}
