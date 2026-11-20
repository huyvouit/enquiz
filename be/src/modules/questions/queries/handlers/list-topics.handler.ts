import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Question } from '../../schemas/question.schema.js';
import { ListTopicsQuery } from '../impl/list-topics.query.js';

@QueryHandler(ListTopicsQuery)
export class ListTopicsHandler implements IQueryHandler<ListTopicsQuery> {
  constructor(
    @InjectModel(Question.name) private readonly questionModel: Model<Question>,
  ) {}

  async execute(): Promise<string[]> {
    const topics = await this.questionModel.distinct('topic');
    return (topics as string[]).sort((a, b) => a.localeCompare(b));
  }
}
