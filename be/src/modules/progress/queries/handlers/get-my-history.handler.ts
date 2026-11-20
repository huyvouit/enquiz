import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Quiz } from '../../../quizzes/schemas/quiz.schema.js';
import { AttemptSummary } from '../../progress.mapper.js';
import { StudentProgress } from '../../schemas/student-progress.schema.js';
import { GetMyHistoryQuery } from '../impl/get-my-history.query.js';

const HISTORY_LIMIT = 100;

@QueryHandler(GetMyHistoryQuery)
export class GetMyHistoryHandler implements IQueryHandler<GetMyHistoryQuery> {
  constructor(
    @InjectModel(StudentProgress.name)
    private readonly progressModel: Model<StudentProgress>,
    @InjectModel(Quiz.name) private readonly quizModel: Model<Quiz>,
  ) {}

  async execute({ studentId }: GetMyHistoryQuery): Promise<AttemptSummary[]> {
    // Read side: lean query without the heavy `details` array.
    const attempts = await this.progressModel
      .find({ studentId: new Types.ObjectId(studentId) }, { details: 0 })
      .sort({ completedAt: -1 })
      .limit(HISTORY_LIMIT)
      .lean();

    const quizIds = [...new Set(attempts.map((a) => a.quizId.toString()))];
    const quizzes = await this.quizModel
      .find({ _id: { $in: quizIds } }, { title: 1, coverEmoji: 1 })
      .lean();
    const quizById = new Map(quizzes.map((q) => [q._id.toString(), q]));

    return attempts.map((a) => {
      const quiz = quizById.get(a.quizId.toString());
      return {
        attemptId: a._id.toString(),
        quizId: a.quizId.toString(),
        quizTitle: quiz?.title ?? null,
        coverEmoji: quiz?.coverEmoji ?? null,
        score: a.score,
        correctCount: a.correctCount,
        totalQuestions: a.totalQuestions,
        passed: a.passed ?? false,
        xpEarned: a.xpEarned ?? 0,
        completedAt: a.completedAt,
      };
    });
  }
}
