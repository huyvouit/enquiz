import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import { expiredBefore } from '../../common/utils/exam-time.js';
import { seededRandom } from '../../common/utils/shuffle.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { answersHiddenUntil } from '../assignments/assignment-status.js';
import { Assignment } from '../assignments/schemas/assignment.schema.js';
import { hideAnswers, toAttemptResult } from '../progress/progress.mapper.js';
import { isPassingScore } from '../progress/progression/progression.rules.js';
import { StudentProgress } from '../progress/schemas/student-progress.schema.js';
import { Question } from '../questions/schemas/question.schema.js';
import { orderByIds, toPlayQuestion } from '../quizzes/quizzes.mapper.js';
import { Quiz } from '../quizzes/schemas/quiz.schema.js';
import { User } from '../users/schemas/user.schema.js';
import {
  type CleanAnswer,
  completedAtOf,
  examDurationSec,
  gradeSheet,
} from './exam-rules.js';
import type {
  ExamResultView,
  ExamSessionView,
  ExamStateView,
} from './exams.mapper.js';
import {
  ExamSession,
  type ExamSessionDoc,
  ExamStatus,
} from './schemas/exam-session.schema.js';

export const EXAM_NOT_FOUND = 'Không tìm thấy bài kiểm tra';
/** Sessions closed per lazy check; the rest wait for the next read. */
const FINALIZE_BATCH = 50;

/** How a session is being closed. */
interface CloseHow {
  answers: CleanAnswer[];
  flagged?: Types.ObjectId[];
  status: ExamStatus.SUBMITTED | ExamStatus.TIMED_OUT;
  isAutoSubmit: boolean;
}

/**
 * Shared by the exam handlers: loading, closing (grading) and the views.
 * The graded attempt is a student_progress record (plan E7) that never
 * goes through XP or station unlocking (E4).
 */
@Injectable()
export class ExamService {
  constructor(
    @InjectModel(ExamSession.name)
    private readonly sessionModel: Model<ExamSession>,
    @InjectModel(StudentProgress.name)
    private readonly progressModel: Model<StudentProgress>,
    @InjectModel(Question.name) private readonly questionModel: Model<Question>,
    @InjectModel(Quiz.name) private readonly quizModel: Model<Quiz>,
    @InjectModel(Assignment.name)
    private readonly assignmentModel: Model<Assignment>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  /** A session owned by `user`; anything else is a 404. */
  async loadOwn(sessionId: string, user: AuthUser): Promise<ExamSessionDoc> {
    const session = Types.ObjectId.isValid(sessionId)
      ? await this.sessionModel.findById(sessionId).lean()
      : null;
    if (!session || session.studentId.toString() !== user.userId) {
      throw new NotFoundException(EXAM_NOT_FOUND);
    }
    return session;
  }

  /**
   * Grades the session and saves the attempt. Returns null when another
   * request closed it first (double click, timer and button together).
   */
  async close(
    session: ExamSessionDoc,
    how: CloseHow,
    now = new Date(),
  ): Promise<ExamSessionDoc | null> {
    // Claim first: only one request can move it out of in_progress.
    const claimed = await this.sessionModel
      .findOneAndUpdate(
        { _id: session._id, status: ExamStatus.IN_PROGRESS },
        {
          $set: {
            status: how.status,
            answers: how.answers,
            ...(how.flagged ? { flagged: how.flagged } : {}),
            submittedAt: now,
            isAutoSubmit: how.isAutoSubmit,
          },
        },
        { returnDocument: 'after' },
      )
      .lean();
    if (!claimed) return null;

    try {
      const questions = orderByIds(
        claimed.questionIds,
        await this.questionModel
          .find({ _id: { $in: claimed.questionIds } })
          .lean(),
      );
      const sheet = gradeSheet(questions, how.answers);
      const completedAt = completedAtOf(
        claimed,
        now,
        how.status === ExamStatus.TIMED_OUT,
      );
      const student = await this.userModel
        .findById(claimed.studentId, { 'studentProfile.level': 1 })
        .lean();
      const progress = await this.progressModel.create({
        studentId: claimed.studentId,
        quizId: claimed.quizId,
        assignmentId: claimed.assignmentId,
        mode: 'exam',
        isAutoSubmit: how.isAutoSubmit,
        score: sheet.score,
        correctCount: sheet.correctCount,
        totalQuestions: sheet.details.length,
        // Kept for display only: progression ignores exams (plan E4).
        passed: isPassingScore(sheet.score),
        xpEarned: 0,
        leveledUp: false,
        levelAfter: student?.studentProfile?.level ?? 1,
        durationSec: examDurationSec(claimed, completedAt),
        details: sheet.details,
        completedAt,
      });
      return await this.sessionModel
        .findByIdAndUpdate(
          claimed._id,
          { $set: { progressId: progress._id } },
          { returnDocument: 'after' },
        )
        .lean();
    } catch (err) {
      // Give the attempt back so the next try (or the lazy check) grades it.
      await this.sessionModel.updateOne(
        { _id: claimed._id, progressId: null },
        { $set: { status: ExamStatus.IN_PROGRESS, submittedAt: null } },
      );
      throw err;
    }
  }

  /** Plan E5: grade every expired session from its saved draft. */
  async finalizeExpired(
    filter: { studentId?: string; sessionId?: Types.ObjectId } = {},
    now = new Date(),
  ): Promise<number> {
    const where: QueryFilter<ExamSession> = {
      status: ExamStatus.IN_PROGRESS,
      deadlineAt: { $lt: expiredBefore(now) },
    };
    if (filter.studentId) {
      where.studentId = new Types.ObjectId(filter.studentId);
    }
    if (filter.sessionId) where._id = filter.sessionId;
    const expired = await this.sessionModel
      .find(where)
      .sort({ deadlineAt: 1 })
      .limit(FINALIZE_BATCH)
      .lean();
    let closed = 0;
    for (const s of expired) {
      const done = await this.close(
        s,
        {
          answers: s.answers,
          status: ExamStatus.TIMED_OUT,
          isAutoSubmit: true,
        },
        now,
      );
      if (done) closed++;
    }
    return closed;
  }

  async sessionView(session: ExamSessionDoc): Promise<ExamSessionView> {
    const [quiz, docs] = await Promise.all([
      this.quizModel
        .findById(session.quizId, { title: 1, coverEmoji: 1 })
        .lean(),
      // Same projection as the practice game: no answer key leaves the
      // server (correctAnswer only scrambles ordering pieces).
      this.questionModel
        .find(
          { _id: { $in: session.questionIds } },
          {
            type: 1,
            questionText: 1,
            mediaUrl: 1,
            audioText: 1,
            audioUrl: 1,
            options: 1,
            pairs: 1,
            correctAnswer: 1,
          },
        )
        .lean(),
    ]);
    const sessionId = session._id.toString();
    return {
      sessionId,
      assignmentId: session.assignmentId.toString(),
      quizId: session.quizId.toString(),
      title: quiz?.title ?? '',
      coverEmoji: quiz?.coverEmoji ?? '📝',
      status: session.status,
      timeLimitSec: session.timeLimitSec,
      startedAt: session.startedAt,
      deadlineAt: session.deadlineAt,
      serverNow: new Date(),
      questions: orderByIds(session.questionIds, docs).map((q) =>
        toPlayQuestion(q, seededRandom(`${sessionId}:${q._id.toString()}`)),
      ),
      answers: session.answers.map((a) => ({
        questionId: a.questionId.toString(),
        answer: a.answer,
      })),
      flagged: session.flagged.map(String),
      draftSavedAt: session.draftSavedAt ?? null,
    };
  }

  async resultView(session: ExamSessionDoc): Promise<ExamResultView> {
    const progress = session.progressId
      ? await this.progressModel.findById(session.progressId).lean()
      : null;
    if (!progress) throw new NotFoundException(EXAM_NOT_FOUND);
    const [quiz, questions, assignment] = await Promise.all([
      this.quizModel
        .findById(session.quizId, { title: 1, coverEmoji: 1 })
        .lean(),
      this.questionModel
        .find({ _id: { $in: progress.details.map((d) => d.questionId) } })
        .lean(),
      this.assignmentModel
        .findById(session.assignmentId, { mode: 1, reveal: 1, dueDate: 1 })
        .lean(),
    ]);
    const result = hideAnswers(
      toAttemptResult(progress, quiz, questions),
      assignment ? answersHiddenUntil(assignment) : null,
    );
    return {
      ...result,
      sessionId: session._id.toString(),
      assignmentId: session.assignmentId.toString(),
      status: session.status,
    };
  }

  async stateView(session: ExamSessionDoc): Promise<ExamStateView> {
    if (session.status === ExamStatus.IN_PROGRESS) {
      return {
        status: session.status,
        session: await this.sessionView(session),
        result: null,
      };
    }
    return {
      status: session.status,
      session: null,
      result: await this.resultView(session),
    };
  }
}
