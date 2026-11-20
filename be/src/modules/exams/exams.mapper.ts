import type { RevealPolicy } from '../assignments/schemas/assignment.schema.js';
import type { AttemptResult } from '../progress/progress.mapper.js';
import type { PlayQuestion } from '../quizzes/quizzes.mapper.js';
import type { ExamStatus } from './schemas/exam-session.schema.js';

/** The exam room: questions without answer keys (plan 4.2). */
export interface ExamSessionView {
  sessionId: string;
  assignmentId: string;
  quizId: string;
  title: string;
  coverEmoji: string;
  status: ExamStatus;
  timeLimitSec: number;
  startedAt: Date;
  deadlineAt: Date;
  /** The client counts down from deadlineAt − serverNow (clock skew, E1). */
  serverNow: Date;
  /** In exam order, option order fixed for the session (E10). */
  questions: PlayQuestion[];
  /** Draft saved on the server (E2). */
  answers: { questionId: string; answer: unknown }[];
  flagged: string[];
  draftSavedAt: Date | null;
}

/** Result after handing in; answers hidden per the teacher's choice (E12). */
export interface ExamResultView extends AttemptResult {
  sessionId: string;
  assignmentId: string;
  status: ExamStatus;
}

/** GET /exams/:id: one of the two, by status. */
export interface ExamStateView {
  status: ExamStatus;
  session: ExamSessionView | null;
  result: ExamResultView | null;
}

/** The start screen (plan E13). */
export interface ExamIntroView {
  assignmentId: string;
  title: string;
  coverEmoji: string;
  questionCount: number;
  timeLimitSec: number;
  dueDate: Date;
  note: string | null;
  className: string;
  /** Closed by the teacher: cannot be started any more. */
  closed: boolean;
  reveal: RevealPolicy;
  state: 'not_started' | 'in_progress' | 'submitted';
  sessionId: string | null;
  deadlineAt: Date | null;
  serverNow: Date;
}
