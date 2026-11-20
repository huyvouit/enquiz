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
 * Checks the student may play `quizId` as homework `assignmentId`.
 * Throws 404 (not assigned to them / wrong quiz) or 409 (closed).
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
