import type { Types } from 'mongoose';
import type { Quiz } from '../quizzes/schemas/quiz.schema.js';
import type { Submission, SubmissionCounts } from './assignment-status.js';
import type {
  Assignment,
  AssignmentStatus,
  AssignmentTargetKind,
} from './schemas/assignment.schema.js';

export type AssignmentDoc = Assignment & { _id: Types.ObjectId };
/** The quiz fields homework views need. */
export type QuizDoc = Pick<
  Quiz,
  'title' | 'coverEmoji' | 'topic' | 'gradeLevel' | 'questionIds'
> & { _id: Types.ObjectId };

/** null when the quiz has been deleted since it was assigned. */
export interface AssignmentQuizRef {
  id: string;
  title: string;
  coverEmoji: string;
  topic: string;
  gradeLevel: number;
  questionCount: number;
}

/** One homework in the teacher's list, with live submission counts. */
export interface AssignmentView {
  id: string;
  classId: string;
  quiz: AssignmentQuizRef | null;
  target: { kind: AssignmentTargetKind; groupName: string | null };
  dueDate: Date;
  status: AssignmentStatus;
  note: string | null;
  createdAt: Date;
  counts: SubmissionCounts;
  averageScore: number | null;
}

export interface SubmissionRow extends Submission {
  student: { id: string; fullName: string; username: string };
}

/** The teacher's submission table for one homework. */
export interface AssignmentDetail extends AssignmentView {
  className: string;
  submissions: SubmissionRow[];
}

/** A homework as the student sees it. */
export interface MyAssignment extends Submission {
  id: string;
  classId: string;
  className: string;
  teacherName: string;
  quiz: AssignmentQuizRef | null;
  dueDate: Date;
  note: string | null;
  createdAt: Date;
  /** Closed by the teacher: cannot be submitted any more. */
  closed: boolean;
  /** Given in the last 72 hours. */
  isNew: boolean;
  /** Not submitted, due within 48 hours. */
  dueSoon: boolean;
}

/** Compact payload for the student home page banner and header badge. */
export interface ReminderView {
  /** Open homework not submitted yet (header badge). */
  pendingCount: number;
  overdue: MyAssignment[];
  dueSoon: MyAssignment[];
  fresh: MyAssignment[];
}

export function toQuizRef(q: QuizDoc | undefined): AssignmentQuizRef | null {
  if (!q) return null;
  return {
    id: q._id.toString(),
    title: q.title,
    coverEmoji: q.coverEmoji,
    topic: q.topic,
    gradeLevel: q.gradeLevel,
    questionCount: q.questionIds.length,
  };
}
