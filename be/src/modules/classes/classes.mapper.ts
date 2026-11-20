import { Types } from 'mongoose';
import type { User } from '../users/schemas/user.schema.js';
import type {
  ClassGroup,
  ClassRoom,
  ClassStatus,
} from './schemas/class-room.schema.js';

export type ClassDoc = ClassRoom & { _id: Types.ObjectId };
type UserDoc = User & { _id: Types.ObjectId };

/** What the class's teacher (or an admin) sees in lists. */
export interface ClassSummary {
  id: string;
  name: string;
  code: string;
  gradeLevel: number;
  schoolName: string | null;
  status: ClassStatus;
  studentCount: number;
  groupCount: number;
  teacher: { id: string; fullName: string } | null;
  createdAt: Date;
}

/** What a student sees about a class they are in (no invite code). */
export interface StudentClassView {
  id: string;
  name: string;
  gradeLevel: number;
  teacherName: string | null;
}

export interface ClassStudent {
  id: string;
  username: string;
  fullName: string;
  gradeLevel: number;
  level: number;
  xp: number;
}

export interface GroupView {
  id: string;
  name: string;
  studentIds: string[];
}

export interface ClassDetail extends ClassSummary {
  students: ClassStudent[];
  groups: GroupView[];
}

/** Result of creating student accounts in bulk. Passwords are shown once. */
export interface CreatedStudent {
  id: string;
  fullName: string;
  username: string;
  password: string;
}

export function toClassSummary(
  c: ClassDoc,
  teacher: { _id: Types.ObjectId; fullName: string } | null,
): ClassSummary {
  return {
    id: c._id.toString(),
    name: c.name,
    code: c.code,
    gradeLevel: c.gradeLevel,
    schoolName: c.schoolName ?? null,
    status: c.status,
    studentCount: c.studentIds.length,
    groupCount: c.groups.length,
    teacher: teacher
      ? { id: teacher._id.toString(), fullName: teacher.fullName }
      : null,
    createdAt: c.createdAt,
  };
}

export const toGroupView = (g: ClassGroup): GroupView => ({
  id: g._id.toString(),
  name: g.name,
  studentIds: g.studentIds.map(String),
});

export const toClassStudent = (u: UserDoc): ClassStudent => ({
  id: u._id.toString(),
  username: u.username,
  fullName: u.fullName,
  gradeLevel: u.studentProfile?.gradeLevel ?? 1,
  level: u.studentProfile?.level ?? 1,
  xp: u.studentProfile?.xp ?? 0,
});

/** Sort helper: Vietnamese alphabetical order by given name, then full name. */
export function byVietnameseName(
  a: { fullName: string },
  b: { fullName: string },
) {
  const given = (n: string) => n.trim().split(/\s+/).pop() ?? n;
  return (
    given(a.fullName).localeCompare(given(b.fullName), 'vi') ||
    a.fullName.localeCompare(b.fullName, 'vi')
  );
}
