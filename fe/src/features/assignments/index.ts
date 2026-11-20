// Public API of the assignments feature (plan 3.2). Other features import only from here.
export { AssignDialog, type AssignDialogProps } from './components/AssignDialog'
export { AssignmentsBadge } from './components/AssignmentsBadge'
export { ClassAssignmentsTab } from './components/ClassAssignmentsTab'
export { HomeworkCard } from './components/HomeworkCard'
export { ReminderBanner } from './components/ReminderBanner'
export { CountsBar, StateChip } from './components/StateParts'
export { SubmissionTable } from './components/SubmissionTable'
export {
  assignmentKeys,
  invalidateAssignments,
  useAssignmentDetail,
  useMyAssignments,
  useReminders,
} from './hooks/useAssignments'
export { STATE_META, targetLabel } from './lib/states'
export { countdown, formatDue } from './lib/vn-time'
export { MyAssignmentsPage } from './pages/MyAssignmentsPage'
export type {
  AssignmentDetail,
  AssignmentQuizRef,
  AssignmentStatus,
  AssignmentTargetKind,
  AssignmentView,
  MyAssignment,
  ReminderView,
  Submission,
  SubmissionCounts,
  SubmissionRow,
  SubmissionState,
} from './types'
