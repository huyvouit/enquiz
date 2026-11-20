/** Mirrors be/src/modules/classes/classes.mapper.ts. Change both together. */

export type ClassStatus = 'active' | 'archived'

/** A class as its teacher (or an admin) sees it in lists. */
export interface ClassSummary {
  id: string
  name: string
  /** Invite code, 6 characters. */
  code: string
  gradeLevel: number
  schoolName: string | null
  status: ClassStatus
  studentCount: number
  groupCount: number
  teacher: { id: string; fullName: string } | null
  createdAt: string
}

/** A class as a student sees it (no invite code). */
export interface StudentClassView {
  id: string
  name: string
  gradeLevel: number
  teacherName: string | null
}

export interface ClassStudent {
  id: string
  username: string
  fullName: string
  gradeLevel: number
  level: number
  xp: number
}

export interface GroupView {
  id: string
  name: string
  studentIds: string[]
}

export interface ClassDetail extends ClassSummary {
  students: ClassStudent[]
  groups: GroupView[]
}

/** Returned once by the bulk create endpoint; passwords are never shown again. */
export interface CreatedStudent {
  id: string
  fullName: string
  username: string
  password: string
}

/**
 * Props of a tab plugged into the class page by the app router
 * (Bài tập from features/assignments, Thống kê from features/analytics).
 * Keeps `classes` free of imports from those features.
 */
export interface ClassTabProps {
  classDetail: ClassDetail
  /** Re-fetches the class (students, groups) after a change. */
  reload: () => void
}
