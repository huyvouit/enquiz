import { Query } from '@nestjs/cqrs';
import type { AuthUser } from '../../../../common/types/auth-user.js';
import type {
  AssignmentDetail,
  AssignmentView,
  MyAssignment,
  ReminderView,
} from '../../assignments.mapper.js';

export class ListClassAssignmentsQuery extends Query<AssignmentView[]> {
  constructor(
    public readonly classId: string,
    public readonly status: 'active' | 'closed' | 'all',
    public readonly user: AuthUser,
  ) {
    super();
  }
}

/** The submission table: every assigned student with their state. */
export class GetAssignmentDetailQuery extends Query<AssignmentDetail> {
  constructor(
    public readonly assignmentId: string,
    public readonly user: AuthUser,
  ) {
    super();
  }
}

export class MyAssignmentsQuery extends Query<MyAssignment[]> {
  constructor(public readonly user: AuthUser) {
    super();
  }
}

export class MyRemindersQuery extends Query<ReminderView> {
  constructor(public readonly user: AuthUser) {
    super();
  }
}

// ---------- Used by other modules through the QueryBus ----------

/** Quizzes the student may open because they were given as homework. */
export class AssignedQuizIdsQuery extends Query<string[]> {
  constructor(public readonly studentId: string) {
    super();
  }
}

/**
 * Checks the student may play `quizId` as practice homework `assignmentId`.
 * Throws 404 (not assigned to them / wrong quiz) or 409 (closed, or an exam:
 * exams are taken through the exams module only).
 */
export class AssignmentPlayAccessQuery extends Query<true> {
  constructor(
    public readonly assignmentId: string,
    public readonly quizId: string,
    public readonly studentId: string,
  ) {
    super();
  }
}

/**
 * Until when the student may not see the answers of an attempt made for
 * this homework (plan E12). null = visible (also for unknown homework).
 */
export class AnswersHiddenUntilQuery extends Query<Date | null> {
  constructor(public readonly assignmentId: string) {
    super();
  }
}
