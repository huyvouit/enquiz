import { ConflictException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  examDeadline,
  isWithinGrace,
} from '../../../../common/utils/exam-time.js';
import { shuffle } from '../../../../common/utils/shuffle.js';
import {
  Assignment,
  AssignmentMode,
  AssignmentStatus,
} from '../../../assignments/schemas/assignment.schema.js';
import { Quiz } from '../../../quizzes/schemas/quiz.schema.js';
import { cleanAnswers, cleanFlags } from '../../exam-rules.js';
import { EXAM_NOT_FOUND, ExamService } from '../../exam.service.js';
import type { ExamResultView, ExamSessionView } from '../../exams.mapper.js';
import { ExamSession, ExamStatus } from '../../schemas/exam-session.schema.js';
import {
  FinalizeExpiredExamsCommand,
  SaveExamDraftCommand,
  StartExamCommand,
  SubmitExamCommand,
} from '../impl/exam.commands.js';

const ALREADY_DONE = 'Em đã làm bài kiểm tra này rồi';
const TIME_UP = 'Đã hết giờ làm bài';

const isDuplicateKey = (err: unknown) =>
  (err as { code?: number })?.code === 11000;

@CommandHandler(StartExamCommand)
export class StartExamHandler implements ICommandHandler<StartExamCommand> {
  constructor(
    @InjectModel(ExamSession.name)
    private readonly sessionModel: Model<ExamSession>,
    @InjectModel(Assignment.name)
    private readonly assignmentModel: Model<Assignment>,
    @InjectModel(Quiz.name) private readonly quizModel: Model<Quiz>,
    private readonly exams: ExamService,
  ) {}

  async execute({
    assignmentId,
    user,
  }: StartExamCommand): Promise<ExamSessionView> {
    await this.exams.finalizeExpired({ studentId: user.userId });
    const key = {
      assignmentId: new Types.ObjectId(assignmentId),
      studentId: new Types.ObjectId(user.userId),
    };

    // F5, closed tab, other device: continue the same session (plan E2).
    const existing = await this.sessionModel.findOne(key).lean();
    if (existing) return this.resume(existing._id);

    const a = await this.assignmentModel
      .findOne({ _id: key.assignmentId, studentIds: key.studentId })
      .lean();
    if (!a || a.mode !== AssignmentMode.EXAM) {
      throw new NotFoundException(EXAM_NOT_FOUND);
    }
    if (a.status === AssignmentStatus.CLOSED) {
      throw new ConflictException('Cô đã đóng bài kiểm tra này rồi em nhé');
    }
    const quiz = await this.quizModel
      .findById(a.quizId, { questionIds: 1, settings: 1 })
      .lean();
    if (!quiz) throw new NotFoundException('Bài quiz đã bị xoá');

    // The question order is fixed now, for the whole attempt (plan E10).
    const questionIds = quiz.settings?.shuffleQuestions
      ? shuffle(quiz.questionIds)
      : quiz.questionIds;
    const startedAt = new Date();
    const timeLimitSec = a.timeLimitSec!;
    try {
      const created = await this.sessionModel.create({
        ...key,
        kind: 'assignment',
        quizId: quiz._id,
        questionIds,
        timeLimitSec,
        startedAt,
        deadlineAt: examDeadline(startedAt, timeLimitSec),
      });
      return this.exams.sessionView(created.toObject());
    } catch (err) {
      // Two "Bắt đầu" at once: the unique index keeps one session (E8).
      if (!isDuplicateKey(err)) throw err;
      const other = await this.sessionModel.findOne(key).lean();
      if (!other) throw err;
      return this.resume(other._id);
    }
  }

  private async resume(id: Types.ObjectId): Promise<ExamSessionView> {
    const session = await this.sessionModel.findById(id).lean();
    if (!session || session.status !== ExamStatus.IN_PROGRESS) {
      throw new ConflictException(ALREADY_DONE);
    }
    return this.exams.sessionView(session);
  }
}

@CommandHandler(SaveExamDraftCommand)
export class SaveExamDraftHandler implements ICommandHandler<SaveExamDraftCommand> {
  constructor(
    @InjectModel(ExamSession.name)
    private readonly sessionModel: Model<ExamSession>,
    private readonly exams: ExamService,
  ) {}

  async execute({
    sessionId,
    dto,
    user,
  }: SaveExamDraftCommand): Promise<{ draftSavedAt: Date }> {
    const session = await this.exams.loadOwn(sessionId, user);
    if (session.status !== ExamStatus.IN_PROGRESS) {
      throw new ConflictException(ALREADY_DONE);
    }
    const now = new Date();
    if (!isWithinGrace(session.deadlineAt, now)) {
      throw new ConflictException(TIME_UP);
    }
    const saved = await this.sessionModel.updateOne(
      { _id: session._id, status: ExamStatus.IN_PROGRESS },
      {
        $set: {
          answers: cleanAnswers(dto.answers, session.questionIds),
          flagged: cleanFlags(dto.flagged, session.questionIds),
          draftSavedAt: now,
        },
      },
    );
    if (saved.matchedCount === 0) throw new ConflictException(ALREADY_DONE);
    return { draftSavedAt: now };
  }
}

@CommandHandler(SubmitExamCommand)
export class SubmitExamHandler implements ICommandHandler<SubmitExamCommand> {
  constructor(private readonly exams: ExamService) {}

  async execute({
    sessionId,
    dto,
    user,
  }: SubmitExamCommand): Promise<ExamResultView> {
    const session = await this.exams.loadOwn(sessionId, user);
    if (session.status === ExamStatus.IN_PROGRESS) {
      const now = new Date();
      // Late hand-in: the answers sent now are ignored, the saved draft is
      // graded, so keeping the page open never buys extra time (plan E5).
      const onTime = isWithinGrace(session.deadlineAt, now);
      await this.exams.close(
        session,
        onTime
          ? {
              answers: cleanAnswers(dto.answers, session.questionIds),
              flagged: cleanFlags(dto.flagged, session.questionIds),
              status: ExamStatus.SUBMITTED,
              isAutoSubmit: dto.isAutoSubmit ?? false,
            }
          : {
              answers: session.answers,
              status: ExamStatus.TIMED_OUT,
              isAutoSubmit: true,
            },
        now,
      );
    }
    // Closed now or before (timer and button together): same result.
    const closed = await this.exams.loadOwn(sessionId, user);
    if (!closed.progressId) throw new ConflictException(ALREADY_DONE);
    return this.exams.resultView(closed);
  }
}

@CommandHandler(FinalizeExpiredExamsCommand)
export class FinalizeExpiredExamsHandler implements ICommandHandler<FinalizeExpiredExamsCommand> {
  constructor(private readonly exams: ExamService) {}

  execute({ filter }: FinalizeExpiredExamsCommand): Promise<number> {
    return this.exams.finalizeExpired(filter);
  }
}
