import { Types } from 'mongoose';
import type { QuestionType } from '../questions/question-types.js';
import type { Question } from '../questions/schemas/question.schema.js';
import { revealAnswer } from './grading/graders.js';
import type {
  Progression,
  QuizRef,
} from './progression/progression.service.js';
import type { QuizSession } from './schemas/quiz-session.schema.js';
import type {
  AnswerDetail,
  StudentProgress,
} from './schemas/student-progress.schema.js';

type ProgressDoc = StudentProgress & { _id: Types.ObjectId };
type QuestionDoc = Question & { _id: Types.ObjectId };
type SessionDoc = QuizSession & { _id: Types.ObjectId };

/** Instant feedback for one answered question. */
export interface AnswerFeedback {
  questionId: string;
  studentAnswer: unknown;
  isCorrect: boolean;
  correctAnswer: unknown;
  explanation?: string;
}

/** POST /progress/sessions — a new or resumed session. */
export interface SessionView {
  sessionId: string;
  quizId: string;
  startedAt: Date;
  answers: AnswerFeedback[];
}

export interface AttemptDetailItem extends AnswerFeedback {
  /** null when the question has since been deleted from the bank. */
  type: QuestionType | null;
  questionText: string | null;
  mediaUrl?: string;
  audioText?: string;
}

export interface AttemptProgression {
  passed: boolean;
  xpEarned: number;
  leveledUp: boolean;
  levelAfter: number;
  /** Only filled right after finishing (not when reopened from history). */
  totalXp: number | null;
  unlockedQuiz: QuizRef | null;
}

/** Returned by POST /progress/sessions/:id/finish and GET /progress/attempts/:id. */
export interface AttemptResult {
  attemptId: string;
  quizId: string;
  /** null when the quiz has since been deleted. */
  quizTitle: string | null;
  coverEmoji: string | null;
  score: number;
  correctCount: number;
  totalQuestions: number;
  progression: AttemptProgression;
  durationSec?: number;
  completedAt: Date;
  details: AttemptDetailItem[];
}

/** Row in a student's history or a teacher's results table. */
export interface AttemptSummary {
  attemptId: string;
  quizId: string;
  quizTitle: string | null;
  coverEmoji: string | null;
  score: number;
  correctCount: number;
  totalQuestions: number;
  passed: boolean;
  xpEarned: number;
  completedAt: Date;
  student?: { id: string; fullName: string; username: string };
}

export function toAnswerFeedback(
  answer: AnswerDetail,
  question: QuestionDoc | undefined,
): AnswerFeedback {
  return {
    questionId: answer.questionId.toString(),
    studentAnswer: answer.studentAnswer,
    isCorrect: answer.isCorrect,
    correctAnswer: question ? revealAnswer(question) : null,
    explanation: question?.explanation,
  };
}

export function toSessionView(
  session: SessionDoc,
  questions: QuestionDoc[],
): SessionView {
  const byId = new Map(questions.map((q) => [q._id.toString(), q]));
  return {
    sessionId: session._id.toString(),
    quizId: session.quizId.toString(),
    startedAt: session.startedAt,
    answers: session.answers.map((a) =>
      toAnswerFeedback(a, byId.get(a.questionId.toString())),
    ),
  };
}

export function toAttemptResult(
  progress: ProgressDoc,
  quiz: { title: string; coverEmoji: string } | null,
  questions: QuestionDoc[],
  fresh?: Progression,
): AttemptResult {
  const byId = new Map(questions.map((q) => [q._id.toString(), q]));
  return {
    attemptId: progress._id.toString(),
    quizId: progress.quizId.toString(),
    quizTitle: quiz?.title ?? null,
    coverEmoji: quiz?.coverEmoji ?? null,
    score: progress.score,
    correctCount: progress.correctCount,
    totalQuestions: progress.totalQuestions,
    progression: {
      passed: progress.passed,
      xpEarned: progress.xpEarned,
      leveledUp: progress.leveledUp,
      levelAfter: progress.levelAfter,
      totalXp: fresh?.totalXp ?? null,
      unlockedQuiz: fresh?.unlockedQuiz ?? null,
    },
    durationSec: progress.durationSec,
    completedAt: progress.completedAt,
    details: progress.details.map((d) => {
      const q = byId.get(d.questionId.toString());
      return {
        ...toAnswerFeedback(d, q),
        type: q?.type ?? null,
        questionText: q?.questionText ?? null,
        mediaUrl: q?.mediaUrl,
        audioText: q?.audioText,
      };
    }),
  };
}
