import { BadRequestException, NotFoundException } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Model, Types } from 'mongoose';
import type { AuthUser } from '../../common/types/auth-user.js';
import {
  ClassAccess,
  ClassAccessQuery,
} from '../classes/queries/impl/class-membership.queries.js';
import { MAX_DUE_DAYS } from './assignment-status.js';
import type { AssignmentDoc } from './assignments.mapper.js';
import { Assignment } from './schemas/assignment.schema.js';

export const ASSIGNMENT_NOT_FOUND = 'Không tìm thấy bài tập';

/**
 * Loads an assignment whose class the user manages (owner teacher or admin).
 * Everything else is a 404.
 */
export async function loadManagedAssignment(
  model: Model<Assignment>,
  queryBus: QueryBus,
  assignmentId: string,
  user: AuthUser,
): Promise<{ assignment: AssignmentDoc; classAccess: ClassAccess }> {
  const assignment = Types.ObjectId.isValid(assignmentId)
    ? await model.findById(assignmentId).lean()
    : null;
  if (!assignment) throw new NotFoundException(ASSIGNMENT_NOT_FOUND);
  try {
    const classAccess = await queryBus.execute(
      new ClassAccessQuery(assignment.classId.toString(), user, 'manage'),
    );
    return { assignment, classAccess };
  } catch (err) {
    if (err instanceof NotFoundException) {
      throw new NotFoundException(ASSIGNMENT_NOT_FOUND);
    }
    throw err;
  }
}

/** Due date must be in the future and at most MAX_DUE_DAYS away. */
export function assertValidDueDate(dueDate: Date, now = new Date()): void {
  if (dueDate.getTime() <= now.getTime()) {
    throw new BadRequestException('Hạn nộp phải ở sau thời điểm hiện tại');
  }
  if (dueDate.getTime() - now.getTime() > MAX_DUE_DAYS * 86_400_000) {
    throw new BadRequestException(
      `Hạn nộp tối đa ${MAX_DUE_DAYS} ngày kể từ hôm nay`,
    );
  }
}
