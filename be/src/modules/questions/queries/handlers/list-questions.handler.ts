import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { escapeRegex } from '../../../../common/utils/regex.js';
import { Model, QueryFilter, Types } from 'mongoose';
import type { Paginated } from '../../../../common/utils/pagination.js';
import { QuestionView, toQuestionView } from '../../questions.mapper.js';
import { Question } from '../../schemas/question.schema.js';
import { ListQuestionsQuery } from '../impl/list-questions.query.js';

@QueryHandler(ListQuestionsQuery)
export class ListQuestionsHandler implements IQueryHandler<ListQuestionsQuery> {
  constructor(
    @InjectModel(Question.name) private readonly questionModel: Model<Question>,
  ) {}

  async execute({
    filters,
    user,
  }: ListQuestionsQuery): Promise<Paginated<QuestionView>> {
    const { page, limit, topic, gradeLevel, type, search, mine } = filters;

    const where: QueryFilter<Question> = {};
    if (topic) where.topic = new RegExp(`^${escapeRegex(topic)}$`, 'i');
    if (gradeLevel) where.gradeLevel = gradeLevel;
    if (type) where.type = type;
    if (search) where.questionText = new RegExp(escapeRegex(search), 'i');
    if (mine) where.createdBy = new Types.ObjectId(user.userId);

    const [items, total] = await Promise.all([
      this.questionModel
        .find(where)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.questionModel.countDocuments(where),
    ]);

    return { items: items.map(toQuestionView), total, page, limit };
  }
}
