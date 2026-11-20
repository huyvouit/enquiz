import { ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { Role } from '../enums/role.enum.js';
import type { AuthUser } from '../types/auth-user.js';

/**
 * Admins may modify anything. Teachers may only modify what they created.
 * System content (createdBy = null) is admin-only.
 */
export function assertCanModify(
  user: AuthUser,
  createdBy: Types.ObjectId | null | undefined,
): void {
  if (user.role === Role.ADMIN) return;
  if (createdBy && createdBy.toString() === user.userId) return;
  throw new ForbiddenException('Bạn chỉ được sửa/xoá nội dung do mình tạo');
}
