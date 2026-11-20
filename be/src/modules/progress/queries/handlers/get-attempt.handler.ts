import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryBus, QueryHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role } from '../../../../common/enums/role.enum.js';
import { TeachesStudentQuery } from '../../../classes/queries/impl/class-membership.queries.js';
import { Question } from '../../../questions/schemas/question.schema.js';
import { Quiz } from '../../../quizzes/schemas/quiz.schema.js';
import { AttemptResult, toAttemptResult } from '../../progress.mapper.js';
import { StudentProgress } from '../../schemas/student-progress.schema.js';
import { GetAttemptQuery } from '../impl/get-attempt.query.js';

/**
 * Visible to: the student who made it, the quiz's author, a teacher of one
 * of the student's classes, admins.
 */
@QueryHandler(GetAttemptQuery)
export class GetAttemptHandler implements IQueryHandler<GetAttemptQuery> {
  constructor(
    @InjectModel(StudentProgress.name)
    private readonly progressModel: Model<StudentProgress>,
    @InjectModel(Quiz.name) private readonly quizModel: Model<Quiz>,
    @InjectModel(Question.name) private readonly questionModel: Model<Question>,
    private readonly queryBus: QueryBus,
  ) {}

  async execute({ attemptId, user }: GetAttemptQuery): Promise<AttemptResult> {
    const attempt = await this.progressModel.findById(attemptId).lean();
    if (!attempt) throw new NotFoundException('Không tìm thấy bài làm');

    const quiz = await this.quizModel
      .findById(attempt.quizId, { title: 1, coverEmoji: 1, createdBy: 1 })
      .lean();

    const isOwner = attempt.studentId.toString() === user.userId;
    const isQuizAuthor = quiz?.createdBy?.toString() === user.userId;
    const allowed =
      isOwner ||
      isQuizAuthor ||
      user.role === Role.ADMIN ||
      (user.role === Role.TEACHER &&
        (await this.queryBus.execute(
          new TeachesStudentQuery(user.userId, attempt.studentId.toString()),
        )));
    if (!allowed) {
      throw new NotFoundException('Không tìm thấy bài làm');
    }

    const questions = await this.questionModel
      .find({ _id: { $in: attempt.details.map((d) => d.questionId) } })
      .lean();
    return toAttemptResult(attempt, quiz, questions);
  }
}
