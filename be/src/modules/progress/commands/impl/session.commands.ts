import { Command } from '@nestjs/cqrs';
import type { AuthUser } from '../../../../common/types/auth-user.js';
import type {
  AnswerFeedback,
  AttemptResult,
  SessionView,
} from '../../progress.mapper.js';

/** Opens (or resumes) the student's session for a quiz. */
export class StartQuizSessionCommand extends Command<SessionView> {
  constructor(
    public readonly quizId: string,
    public readonly user: AuthUser,
    public readonly assignmentId: string | null = null,
  ) {
    super();
  }
}

/** Grades one answer immediately. The first answer to a question is final. */
export class AnswerQuestionCommand extends Command<
  AnswerFeedback & { alreadyAnswered: boolean }
> {
  constructor(
    public readonly sessionId: string,
    public readonly questionId: string,
    public readonly studentAnswer: unknown,
    public readonly user: AuthUser,
  ) {
    super();
  }
}

/** Turns the session into a saved attempt and updates level/XP. */
export class FinishQuizSessionCommand extends Command<AttemptResult> {
  constructor(
    public readonly sessionId: string,
    public readonly user: AuthUser,
  ) {
    super();
  }
}
