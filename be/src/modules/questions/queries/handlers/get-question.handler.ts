import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { QuestionView, toQuestionView } from '../../questions.mapper.js';
import { Question } from '../../schemas/question.schema.js';
import { GetQuestionQuery } from '../impl/get-question.query.js';

@QueryHandler(GetQuestionQuery)
export class GetQuestionHandler implements IQueryHandler<GetQuestionQuery> {
  constructor(
    @InjectModel(Question.name) private readonly questionModel: Model<Question>,
  ) {}

  async execute({ id }: GetQuestionQuery): Promise<QuestionView> {
    const question = await this.questionModel.findById(id).lean();
    if (!question) throw new NotFoundException('Không tìm thấy câu hỏi');
    return toQuestionView(question);
  }
}
