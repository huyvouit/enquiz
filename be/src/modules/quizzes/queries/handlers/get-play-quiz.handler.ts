import { ForbiddenException } from '@nestjs/common';
import { IQueryHandler, QueryBus, QueryHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { shuffle } from '../../../../common/utils/shuffle.js';
import { IsQuizUnlockedQuery } from '../../../progress/queries/impl/progression.queries.js';
import { Question } from '../../../questions/schemas/question.schema.js';
import { assertCanSeeQuiz, assignedQuizIds } from '../../quiz-access.js';
import { orderByIds, PlayQuiz, toPlayQuestion } from '../../quizzes.mapper.js';
import { Quiz } from '../../schemas/quiz.schema.js';
import { GetPlayQuizQuery } from '../impl/get-play-quiz.query.js';

@QueryHandler(GetPlayQuizQuery)
export class GetPlayQuizHandler implements IQueryHandler<GetPlayQuizQuery> {
  constructor(
    @InjectModel(Quiz.name) private readonly quizModel: Model<Quiz>,
    @InjectModel(Question.name) private readonly questionModel: Model<Question>,
    private readonly queryBus: QueryBus,
  ) {}

  async execute({ id, user }: GetPlayQuizQuery): Promise<PlayQuiz> {
    const quiz = await this.quizModel.findById(id).lean();
    assertCanSeeQuiz(user, quiz, await assignedQuizIds(this.queryBus, user));
    // Quest-map locking is owned by the Progress module (homework is never locked).
    if (!(await this.queryBus.execute(new IsQuizUnlockedQuery(user, quiz)))) {
      throw new ForbiddenException(
        'Trạm này chưa mở khoá. Em hãy vượt qua trạm trước nhé! 🔒',
      );
    }

    // Only load what the game needs; answer keys never leave the server
    // (see toPlayQuestion).
    const questions = await this.questionModel
      .find(
        { _id: { $in: quiz.questionIds } },
        {
          type: 1,
          questionText: 1,
          mediaUrl: 1,
          // audioText only flags listening questions without audio; never sent.
          audioText: 1,
          audioUrl: 1,
          options: 1,
          pairs: 1,
          // Only to scramble ordering pieces; toPlayQuestion never returns it.
          correctAnswer: 1,
        },
      )
      .lean();

    let ordered = orderByIds(quiz.questionIds, questions);
    if (quiz.settings?.shuffleQuestions) ordered = shuffle(ordered);

    return {
      id: quiz._id.toString(),
      title: quiz.title,
      topic: quiz.topic,
      gradeLevel: quiz.gradeLevel,
      coverEmoji: quiz.coverEmoji,
      questions: ordered.map((q) => toPlayQuestion(q)),
    };
  }
}
