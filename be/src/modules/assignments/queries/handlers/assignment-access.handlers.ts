import { ConflictException, NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ASSIGNMENT_NOT_FOUND } from '../../assignment-access.js';
import {
  Assignment,
  AssignmentStatus,
} from '../../schemas/assignment.schema.js';
import {
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
        { quizId: 1, status: 1 },
      )
      .lean();
    if (!a || a.quizId.toString() !== quizId) {
      throw new NotFoundException(ASSIGNMENT_NOT_FOUND);
    }
    if (a.status === AssignmentStatus.CLOSED) {
      throw new ConflictException('Cô đã đóng bài tập này rồi em nhé');
    }
    return true;
  }
}
