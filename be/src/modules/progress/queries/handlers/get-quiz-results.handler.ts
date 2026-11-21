import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryBus, QueryHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role } from '../../../../common/enums/role.enum.js';
import { assertCanModify } from '../../../../common/utils/ownership.js';
import { TaughtStudentIdsQuery } from '../../../classes/queries/impl/class-membership.queries.js';
import { Quiz } from '../../../quizzes/schemas/quiz.schema.js';
import { User } from '../../../users/schemas/user.schema.js';
import { AttemptSummary } from '../../progress.mapper.js';
import { StudentProgress } from '../../schemas/student-progress.schema.js';
import { GetQuizResultsQuery } from '../impl/get-quiz-results.query.js';

const RESULTS_LIMIT = 500;

@QueryHandler(GetQuizResultsQuery)
export class GetQuizResultsHandler implements IQueryHandler<GetQuizResultsQuery> {
  constructor(
    @InjectModel(StudentProgress.name)
    private readonly progressModel: Model<StudentProgress>,
    @InjectModel(Quiz.name) private readonly quizModel: Model<Quiz>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly queryBus: QueryBus,
  ) {}

  async execute({
    quizId,
    user,
  }: GetQuizResultsQuery): Promise<AttemptSummary[]> {
    const quiz = await this.quizModel.findById(quizId).lean();
    if (!quiz) throw new NotFoundException('Không tìm thấy bài quiz');
    // Same rule as editing: the author or an admin.
    assertCanModify(user, quiz.createdBy);

    // A shared quiz is played by other teachers' classes too: its author sees
    // only their own students (children's data, launch A1); admins see all.
    const filter: Record<string, unknown> = { quizId: quiz._id };
    if (user.role !== Role.ADMIN) {
      const taught = await this.queryBus.execute(
        new TaughtStudentIdsQuery(user.userId),
      );
      filter.studentId = { $in: taught.map((id) => new Types.ObjectId(id)) };
    }

    const attempts = await this.progressModel
      .find(filter, { details: 0 })
      .sort({ completedAt: -1 })
      .limit(RESULTS_LIMIT)
      .lean();

    const studentIds = [
      ...new Set(attempts.map((a) => a.studentId.toString())),
    ];
    const students = await this.userModel
      .find({ _id: { $in: studentIds } }, { fullName: 1, username: 1 })
      .lean();
    const studentById = new Map(students.map((s) => [s._id.toString(), s]));

    return attempts.map((a) => {
      const s = studentById.get(a.studentId.toString());
      return {
        attemptId: a._id.toString(),
        quizId: a.quizId.toString(),
        quizTitle: quiz.title,
        coverEmoji: quiz.coverEmoji,
        score: a.score,
        correctCount: a.correctCount,
        totalQuestions: a.totalQuestions,
        passed: a.passed ?? false,
        xpEarned: a.xpEarned ?? 0,
        mode: a.mode ?? 'classic',
        completedAt: a.completedAt,
        student: {
          id: a.studentId.toString(),
          fullName: s?.fullName ?? '(đã xoá)',
          username: s?.username ?? '',
        },
      };
    });
  }
}
