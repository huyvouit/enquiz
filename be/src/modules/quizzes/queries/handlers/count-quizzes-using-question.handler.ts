import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Quiz } from '../../schemas/quiz.schema.js';
import { CountQuizzesUsingQuestionQuery } from '../impl/count-quizzes-using-question.query.js';

@QueryHandler(CountQuizzesUsingQuestionQuery)
export class CountQuizzesUsingQuestionHandler implements IQueryHandler<CountQuizzesUsingQuestionQuery> {
  constructor(
    @InjectModel(Quiz.name) private readonly quizModel: Model<Quiz>,
  ) {}

  execute({ questionId }: CountQuizzesUsingQuestionQuery): Promise<number> {
    return this.quizModel.countDocuments({
      questionIds: new Types.ObjectId(questionId),
    });
  }
}
