import { Command } from '@nestjs/cqrs';
import type { AuthUser } from '../../../../common/types/auth-user.js';
import type {
  ClassDetail,
  ClassSummary,
  CreatedStudent,
  GroupView,
  StudentClassView,
} from '../../classes.mapper.js';
import type {
  CreateClassDto,
  GroupDto,
  UpdateClassDto,
} from '../../dto/class.dto.js';

export class CreateClassCommand extends Command<ClassSummary> {
  constructor(
    public readonly dto: CreateClassDto,
    public readonly user: AuthUser,
  ) {
    super();
  }
}

export class UpdateClassCommand extends Command<ClassSummary> {
  constructor(
    public readonly classId: string,
    public readonly dto: UpdateClassDto,
    public readonly user: AuthUser,
  ) {
    super();
  }
}

/** New invite code; the old one stops working. */
export class RegenerateClassCodeCommand extends Command<ClassSummary> {
  constructor(
    public readonly classId: string,
    public readonly user: AuthUser,
  ) {
    super();
  }
}

/** Student joins with the invite code. Joining twice is a no-op. */
export class JoinClassCommand extends Command<StudentClassView> {
  constructor(
    public readonly code: string,
    public readonly user: AuthUser,
  ) {
    super();
  }
}

/** Teacher creates student accounts and adds them to the class. */
export class BulkCreateStudentsCommand extends Command<{
  class: ClassDetail;
  created: CreatedStudent[];
}> {
  constructor(
    public readonly classId: string,
    public readonly fullNames: string[],
    public readonly user: AuthUser,
  ) {
    super();
  }
}

/** Removes the student from the class and its groups (account is kept). */
export class RemoveStudentCommand extends Command<void> {
  constructor(
    public readonly classId: string,
    public readonly studentId: string,
    public readonly user: AuthUser,
  ) {
    super();
  }
}

/** Creates (groupId = null) or replaces a group. */
export class SaveGroupCommand extends Command<GroupView> {
  constructor(
    public readonly classId: string,
    public readonly groupId: string | null,
    public readonly dto: GroupDto,
    public readonly user: AuthUser,
  ) {
    super();
  }
}

export class DeleteGroupCommand extends Command<void> {
  constructor(
    public readonly classId: string,
    public readonly groupId: string,
    public readonly user: AuthUser,
  ) {
    super();
  }
}
