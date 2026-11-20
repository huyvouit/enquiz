import { Query } from '@nestjs/cqrs';
import type { AuthUser } from '../../../../common/types/auth-user.js';
import type { ExamIntroView, ExamStateView } from '../../exams.mapper.js';
import type { ExamStatus } from '../../schemas/exam-session.schema.js';

/** What the start screen shows (plan E13). */
export class GetExamIntroQuery extends Query<ExamIntroView> {
  constructor(
    public readonly assignmentId: string,
    public readonly user: AuthUser,
  ) {
    super();
  }
}

/** The session in progress, or the result once handed in. */
export class GetExamQuery extends Query<ExamStateView> {
  constructor(
    public readonly sessionId: string,
    public readonly user: AuthUser,
  ) {
    super();
  }
}

// ---------- Used by other modules through the QueryBus ----------

export interface ExamSessionState {
  assignmentId: string;
  studentId: string;
  sessionId: string;
  status: ExamStatus;
  deadlineAt: Date;
}

/** Exam sessions of these homework (optionally of one student). */
export class ExamSessionStatesQuery extends Query<ExamSessionState[]> {
  constructor(
    public readonly assignmentIds: string[],
    public readonly studentId?: string,
  ) {
    super();
  }
}

/**
 * True when the student has an exam in progress on this quiz: practice of
 * the same quiz is refused meanwhile (plan E11).
 */
export class ActiveExamOnQuizQuery extends Query<boolean> {
  constructor(
    public readonly studentId: string,
    public readonly quizId: string,
  ) {
    super();
  }
}

/** True once any student has started this exam (mode/time are then fixed). */
export class ExamStartedQuery extends Query<boolean> {
  constructor(public readonly assignmentId: string) {
    super();
  }
}
