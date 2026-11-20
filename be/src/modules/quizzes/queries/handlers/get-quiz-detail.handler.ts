import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { toQuestionView } from '../../../questions/questions.mapper.js';
import { Question } from '../../../questions/schemas/question.schema.js';
import { assertCanSeeQuiz } from '../../quiz-access.js';
import { QuizAuthorsService } from '../../quiz-authors.service.js';
import { orderByIds, QuizDetail, toQuizSummary } from '../../quizzes.mapper.js';
import { Quiz } from '../../schemas/quiz.schema.js';
import { GetQuizDetailQuery } from '../impl/get-quiz-detail.query.js';

@QueryHandler(GetQuizDetailQuery)
export class GetQuizDetailHandler implements IQueryHandler<GetQuizDetailQuery> {
  constructor(
    @InjectModel(Quiz.name) private readonly quizModel: Model<Quiz>,
    @InjectModel(Question.name) private readonly questionModel: Model<Question>,
    private readonly authors: QuizAuthorsService,
  ) {}

  async execute({ id, user }: GetQuizDetailQuery): Promise<QuizDetail> {
    const quiz = await this.quizModel.findById(id).lean();
    assertCanSeeQuiz(user, quiz);

    const [questions, authors] = await Promise.all([
      this.questionModel.find({ _id: { $in: quiz.questionIds } }).lean(),
      this.authors.resolve([quiz.createdBy]),
    ]);

    return {
      ...toQuizSummary(
        quiz,
        quiz.createdBy
          ? (authors.get(quiz.createdBy.toString()) ?? null)
          : null,
      ),
      settings: { shuffleQuestions: quiz.settings?.shuffleQuestions ?? false },
      questions: orderByIds(quiz.questionIds, questions).map(toQuestionView),
    };
  }
}
