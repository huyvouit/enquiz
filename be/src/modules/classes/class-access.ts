import { NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { Role } from '../../common/enums/role.enum.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import type { ClassDoc } from './classes.mapper.js';
import { ClassRoom } from './schemas/class-room.schema.js';

export const CLASS_NOT_FOUND = 'Không tìm thấy lớp học';

/** Teacher who owns the class, or an admin. */
export function canManageClass(
  user: AuthUser,
  c: Pick<ClassRoom, 'teacherId'>,
): boolean {
  return user.role === Role.ADMIN || c.teacherId.toString() === user.userId;
}

/** Managers plus students who are members. */
export function canViewClass(
  user: AuthUser,
  c: Pick<ClassRoom, 'teacherId' | 'studentIds'>,
): boolean {
  if (canManageClass(user, c)) return true;
  return (
    user.role === Role.STUDENT &&
    c.studentIds.some((id) => id.toString() === user.userId)
  );
}

/**
 * Loads a class the user may manage. Anything else is a 404 so classes of
 * other teachers are not discoverable by id.
 */
export async function loadManagedClass(
  model: Model<ClassRoom>,
  classId: string,
  user: AuthUser,
): Promise<ClassDoc> {
  const c = Types.ObjectId.isValid(classId)
    ? await model.findById(classId).lean()
    : null;
  if (!c || !canManageClass(user, c)) {
    throw new NotFoundException(CLASS_NOT_FOUND);
  }
  return c;
}
