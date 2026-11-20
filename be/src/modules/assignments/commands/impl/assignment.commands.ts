import { Command } from '@nestjs/cqrs';
import type { AuthUser } from '../../../../common/types/auth-user.js';
import type { AssignmentView } from '../../assignments.mapper.js';
import type {
  CreateAssignmentDto,
  UpdateAssignmentDto,
} from '../../dto/assignment.dto.js';

export class CreateAssignmentCommand extends Command<AssignmentView> {
  constructor(
    public readonly classId: string,
    public readonly dto: CreateAssignmentDto,
    public readonly user: AuthUser,
  ) {
    super();
  }
}

/** Change the due date / note, or close and reopen. */
export class UpdateAssignmentCommand extends Command<AssignmentView> {
  constructor(
    public readonly assignmentId: string,
    public readonly dto: UpdateAssignmentDto,
    public readonly user: AuthUser,
  ) {
    super();
  }
}

/** Attempts made for it stay in the student's history. */
export class DeleteAssignmentCommand extends Command<void> {
  constructor(
    public readonly assignmentId: string,
    public readonly user: AuthUser,
  ) {
    super();
  }
}
