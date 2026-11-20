import { Command } from '@nestjs/cqrs';
import type { AuthUser } from '../../../../common/types/auth-user.js';
import type { ExamResultView, ExamSessionView } from '../../exams.mapper.js';
import type { ExamAnswersDto, SubmitExamDto } from '../../dto/exam.dto.js';

/** Starts the exam, or returns the session already in progress. */
export class StartExamCommand extends Command<ExamSessionView> {
  constructor(
    public readonly assignmentId: string,
    public readonly user: AuthUser,
  ) {
    super();
  }
}

/** Saves the draft answers and flags (plan E2). */
export class SaveExamDraftCommand extends Command<{ draftSavedAt: Date }> {
  constructor(
    public readonly sessionId: string,
    public readonly dto: ExamAnswersDto,
    public readonly user: AuthUser,
  ) {
    super();
  }
}

export class SubmitExamCommand extends Command<ExamResultView> {
  constructor(
    public readonly sessionId: string,
    public readonly dto: SubmitExamDto,
    public readonly user: AuthUser,
  ) {
    super();
  }
}

// ---------- Used by other modules through the CommandBus ----------

/**
 * Grades every session past its deadline + grace from its saved draft
 * (plan E5). Run, and awaited, before reading homework states or analytics,
 * so nothing depends on a background job.
 */
export class FinalizeExpiredExamsCommand extends Command<number> {
  constructor(public readonly filter: { studentId?: string } = {}) {
    super();
  }
}
