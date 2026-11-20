import { Types } from 'mongoose';
import { AccountStatus } from '../../common/enums/account-status.enum.js';
import { Role } from '../../common/enums/role.enum.js';
import type { StudentProfile, User } from './schemas/user.schema.js';

/** The user shape the API exposes. Never contains the password hash. */
export interface PublicUser {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  status: AccountStatus;
  studentProfile?: StudentProfile;
  createdAt: Date;
}

export function toPublicUser(user: User & { _id: Types.ObjectId }): PublicUser {
  return {
    id: user._id.toString(),
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    status: user.status ?? AccountStatus.ACTIVE,
    studentProfile: user.studentProfile
      ? {
          gradeLevel: user.studentProfile.gradeLevel,
          level: user.studentProfile.level ?? 1,
          xp: user.studentProfile.xp ?? 0,
        }
      : undefined,
    createdAt: user.createdAt,
  };
}

/**
 * "Nguyễn Minh Anh" -> "Anh N." (given name + family-name initial).
 * Used wherever children outside the student's own class could read it.
 */
export function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return parts[0] ?? '';
  const given = parts[parts.length - 1];
  return `${given} ${parts[0].charAt(0).toUpperCase()}.`;
}
