import { Query } from '@nestjs/cqrs';
import type { AuthUser } from '../../../../common/types/auth-user.js';

/** Does this teacher have this student in one of their active classes? */
export class TeachesStudentQuery extends Query<boolean> {
  constructor(
    public readonly teacherId: string,
    public readonly studentId: string,
  ) {
    super();
  }
}

/**
 * Ids of every student in this teacher's classes, archived ones included
 * (past results stay visible to their own teacher). Used to limit what a
 * quiz author sees of a shared quiz to their own students (launch A1).
 */
export class TaughtStudentIdsQuery extends Query<string[]> {
  constructor(public readonly teacherId: string) {
    super();
  }
}

/** A class as other modules need it, after the access check. */
export interface ClassAccess {
  id: string;
  name: string;
  gradeLevel: number;
  schoolName: string | null;
  teacherId: string;
  teacherName: string;
  studentIds: string[];
  groups: { id: string; name: string; studentIds: string[] }[];
}

/**
 * Loads a class for another module (assignments, analytics, leaderboard).
 * `manage`: owner teacher or admin. `view`: also member students.
 * Throws 404 when the user has no access.
 */
export class ClassAccessQuery extends Query<ClassAccess> {
  constructor(
    public readonly classId: string,
    public readonly user: AuthUser,
    public readonly mode: 'manage' | 'view',
  ) {
    super();
  }
}

/** Ids of the active classes a student belongs to. */
export class StudentClassIdsQuery extends Query<string[]> {
  constructor(public readonly studentId: string) {
    super();
  }
}
