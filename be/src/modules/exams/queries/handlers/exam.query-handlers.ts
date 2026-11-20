import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import { expiredBefore } from '../../../../common/utils/exam-time.js';
import {
  Assignment,
  AssignmentMode,
  AssignmentStatus,
  RevealPolicy,
} from '../../../assignments/schemas/assignment.schema.js';
import { ClassRoom } from '../../../classes/schemas/class-room.schema.js';
import { Quiz } from '../../../quizzes/schemas/quiz.schema.js';
import { EXAM_NOT_FOUND, ExamService } from '../../exam.service.js';
import type { ExamIntroView, ExamStateView } from '../../exams.mapper.js';
import { ExamSession, ExamStatus } from '../../schemas/exam-session.schema.js';
import {
  ActiveExamOnQuizQuery,
  ExamSessionState,
  ExamSessionStatesQuery,
  ExamStartedQuery,
  GetExamIntroQuery,
  GetExamQuery,
} from '../impl/exam.queries.js';

@QueryHandler(GetExamIntroQuery)
export class GetExamIntroHandler implements IQueryHandler<GetExamIntroQuery> {
  constructor(
    @InjectModel(ExamSession.name)
    private readonly sessionModel: Model<ExamSession>,
    @InjectModel(Assignment.name)
    private readonly assignmentModel: Model<Assignment>,
    @InjectModel(Quiz.name) private readonly quizModel: Model<Quiz>,
    @InjectModel(ClassRoom.name) private readonly classModel: Model<ClassRoom>,
    private readonly exams: ExamService,
  ) {}

  async execute({
    assignmentId,
    user,
  }: GetExamIntroQuery): Promise<ExamIntroView> {
    const studentId = new Types.ObjectId(user.userId);
    const a = Types.ObjectId.isValid(assignmentId)
      ? await this.assignmentModel
          .findOne({ _id: assignmentId, studentIds: studentId })
          .lean()
      : null;
    if (!a || a.mode !== AssignmentMode.EXAM) {
      throw new NotFoundException(EXAM_NOT_FOUND);
    }
    await this.exams.finalizeExpired({ studentId: user.userId });
    const [quiz, classRoom, session] = await Promise.all([
      this.quizModel
        .findById(a.quizId, { title: 1, coverEmoji: 1, questionIds: 1 })
        .lean(),
      this.classModel.findById(a.classId, { name: 1 }).lean(),
      this.sessionModel
        .findOne(
          { assignmentId: a._id, studentId },
          { status: 1, deadlineAt: 1 },
        )
        .lean(),
    ]);
    if (!quiz) throw new NotFoundException('Bài quiz đã bị xoá');
    return {
      assignmentId: a._id.toString(),
      title: quiz.title,
      coverEmoji: quiz.coverEmoji,
      questionCount: quiz.questionIds.length,
      timeLimitSec: a.timeLimitSec!,
      dueDate: a.dueDate,
      note: a.note ?? null,
      className: classRoom?.name ?? '',
      closed: a.status === AssignmentStatus.CLOSED,
      reveal: a.reveal ?? RevealPolicy.AFTER_SUBMIT,
      state: !session
        ? 'not_started'
        : session.status === ExamStatus.IN_PROGRESS
          ? 'in_progress'
          : 'submitted',
      sessionId: session?._id.toString() ?? null,
      deadlineAt: session?.deadlineAt ?? null,
      serverNow: new Date(),
    };
  }
}

@QueryHandler(GetExamQuery)
export class GetExamHandler implements IQueryHandler<GetExamQuery> {
  constructor(private readonly exams: ExamService) {}

  async execute({ sessionId, user }: GetExamQuery): Promise<ExamStateView> {
    const session = await this.exams.loadOwn(sessionId, user);
    if (session.status !== ExamStatus.IN_PROGRESS) {
      return this.exams.stateView(session);
    }
    // Time ran out while away: grade the saved draft now (plan E5).
    const closed = await this.exams.finalizeExpired({ sessionId: session._id });
    return this.exams.stateView(
      closed > 0 ? await this.exams.loadOwn(sessionId, user) : session,
    );
  }
}

@QueryHandler(ExamSessionStatesQuery)
export class ExamSessionStatesHandler implements IQueryHandler<ExamSessionStatesQuery> {
  constructor(
    @InjectModel(ExamSession.name)
    private readonly sessionModel: Model<ExamSession>,
  ) {}

  async execute({
    assignmentIds,
    studentId,
  }: ExamSessionStatesQuery): Promise<ExamSessionState[]> {
    if (assignmentIds.length === 0) return [];
    const where: QueryFilter<ExamSession> = {
      assignmentId: { $in: assignmentIds.map((id) => new Types.ObjectId(id)) },
    };
    if (studentId) where.studentId = new Types.ObjectId(studentId);
    const rows = await this.sessionModel
      .find(where, { assignmentId: 1, studentId: 1, status: 1, deadlineAt: 1 })
      .lean();
    return rows.map((r) => ({
      assignmentId: r.assignmentId.toString(),
      studentId: r.studentId.toString(),
      sessionId: r._id.toString(),
      status: r.status,
      deadlineAt: r.deadlineAt,
    }));
  }
}

@QueryHandler(ActiveExamOnQuizQuery)
export class ActiveExamOnQuizHandler implements IQueryHandler<ActiveExamOnQuizQuery> {
  constructor(
    @InjectModel(ExamSession.name)
    private readonly sessionModel: Model<ExamSession>,
  ) {}

  async execute({
    studentId,
    quizId,
  }: ActiveExamOnQuizQuery): Promise<boolean> {
    const open = await this.sessionModel.exists({
      studentId: new Types.ObjectId(studentId),
      quizId: new Types.ObjectId(quizId),
      status: ExamStatus.IN_PROGRESS,
      deadlineAt: { $gte: expiredBefore() },
    });
    return open !== null;
  }
}

@QueryHandler(ExamStartedQuery)
export class ExamStartedHandler implements IQueryHandler<ExamStartedQuery> {
  constructor(
    @InjectModel(ExamSession.name)
    private readonly sessionModel: Model<ExamSession>,
  ) {}

  async execute({ assignmentId }: ExamStartedQuery): Promise<boolean> {
    const any = await this.sessionModel.exists({
      assignmentId: new Types.ObjectId(assignmentId),
    });
    return any !== null;
  }
}
