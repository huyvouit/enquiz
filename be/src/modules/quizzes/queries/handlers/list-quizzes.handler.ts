import { IQueryHandler, QueryBus, QueryHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import type { Paginated } from '../../../../common/utils/pagination.js';
import { escapeRegex } from '../../../../common/utils/regex.js';
import { assignedQuizIds, visibleQuizzesFilter } from '../../quiz-access.js';
import { QuizAuthorsService } from '../../quiz-authors.service.js';
import { QuizSummary, toQuizSummary } from '../../quizzes.mapper.js';
import { Quiz } from '../../schemas/quiz.schema.js';
import { ListQuizzesQuery } from '../impl/list-quizzes.query.js';

@QueryHandler(ListQuizzesQuery)
export class ListQuizzesHandler implements IQueryHandler<ListQuizzesQuery> {
  constructor(
    @InjectModel(Quiz.name) private readonly quizModel: Model<Quiz>,
    private readonly authors: QuizAuthorsService,
    private readonly queryBus: QueryBus,
  ) {}

  async execute({
    filters,
    user,
  }: ListQuizzesQuery): Promise<Paginated<QuizSummary>> {
    const where: QueryFilter<Quiz> = {
      ...visibleQuizzesFilter(user, await assignedQuizIds(this.queryBus, user)),
    };
    if (filters.topic) where.topic = filters.topic;
    if (filters.gradeLevel) where.gradeLevel = filters.gradeLevel;
    if (filters.mine) where.createdBy = new Types.ObjectId(user.userId);
    if (filters.search?.trim()) {
      where.title = new RegExp(escapeRegex(filters.search.trim()), 'i');
    }
    const { page, limit } = filters;

    const [quizzes, total] = await Promise.all([
      this.quizModel
        .find(where)
        .sort({ gradeLevel: 1, createdAt: 1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.quizModel.countDocuments(where),
    ]);

    const authors = await this.authors.resolve(quizzes.map((q) => q.createdBy));
    const items = quizzes.map((q) =>
      toQuizSummary(
        q,
        q.createdBy ? (authors.get(q.createdBy.toString()) ?? null) : null,
      ),
    );
    return { items, total, page, limit };
  }
}
