import { ConflictException, NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ASSIGNMENT_NOT_FOUND } from '../../assignment-access.js';
import { answersHiddenUntil } from '../../assignment-status.js';
import {
  Assignment,
  AssignmentMode,
  AssignmentStatus,
} from '../../schemas/assignment.schema.js';
import {
  AnswersHiddenUntilQuery,
  AssignedQuizIdsQuery,
  AssignmentPlayAccessQuery,
} from '../impl/assignment.queries.js';

@QueryHandler(AssignedQuizIdsQuery)
export class AssignedQuizIdsHandler implements IQueryHandler<AssignedQuizIdsQuery> {
  constructor(
    @InjectModel(Assignment.name)
    private readonly assignmentModel: Model<Assignment>,
  ) {}

  async execute({ studentId }: AssignedQuizIdsQuery): Promise<string[]> {
    const ids = await this.assignmentModel.distinct('quizId', {
      studentIds: new Types.ObjectId(studentId),
      status: AssignmentStatus.ACTIVE,
      // An exam quiz is seen only once the exam starts (no preview).
      mode: { $ne: AssignmentMode.EXAM },
    });
    return ids.map(String);
  }
}

@QueryHandler(AssignmentPlayAccessQuery)
export class AssignmentPlayAccessHandler implements IQueryHandler<AssignmentPlayAccessQuery> {
  constructor(
    @InjectModel(Assignment.name)
    private readonly assignmentModel: Model<Assignment>,
  ) {}

  async execute({
    assignmentId,
    quizId,
    studentId,
  }: AssignmentPlayAccessQuery): Promise<true> {
    const a = await this.assignmentModel
      .findOne(
        {
          _id: new Types.ObjectId(assignmentId),
          studentIds: new Types.ObjectId(studentId),
        },
        { quizId: 1, status: 1, mode: 1 },
      )
      .lean();
    if (!a || a.quizId.toString() !== quizId) {
      throw new NotFoundException(ASSIGNMENT_NOT_FOUND);
    }
    if (a.mode === AssignmentMode.EXAM) {
      throw new ConflictException(
        'Đây là bài kiểm tra, em mở từ mục Bài tập nhé',
      );
    }
    if (a.status === AssignmentStatus.CLOSED) {
      throw new ConflictException('Cô đã đóng bài tập này rồi em nhé');
    }
    return true;
  }
}

@QueryHandler(AnswersHiddenUntilQuery)
export class AnswersHiddenUntilHandler implements IQueryHandler<AnswersHiddenUntilQuery> {
  constructor(
    @InjectModel(Assignment.name)
    private readonly assignmentModel: Model<Assignment>,
  ) {}

  async execute({
    assignmentId,
  }: AnswersHiddenUntilQuery): Promise<Date | null> {
    const a = Types.ObjectId.isValid(assignmentId)
      ? await this.assignmentModel
          .findById(assignmentId, { mode: 1, reveal: 1, dueDate: 1 })
          .lean()
      : null;
    return a ? answersHiddenUntil(a) : null;
  }
}
