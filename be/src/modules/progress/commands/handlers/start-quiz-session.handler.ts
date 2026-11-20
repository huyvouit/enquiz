import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler, QueryBus } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ActiveExamOnQuizQuery } from '../../../exams/queries/impl/exam.queries.js';
import { Question } from '../../../questions/schemas/question.schema.js';
import { AssignmentPlayAccessQuery } from '../../../assignments/queries/impl/assignment.queries.js';
import { assertCanSeeQuiz } from '../../../quizzes/quiz-access.js';
import { Quiz } from '../../../quizzes/schemas/quiz.schema.js';
import { SessionView, toSessionView } from '../../progress.mapper.js';
import { ProgressionService } from '../../progression/progression.service.js';
import { QuizSession } from '../../schemas/quiz-session.schema.js';
import { StartQuizSessionCommand } from '../impl/session.commands.js';

@CommandHandler(StartQuizSessionCommand)
export class StartQuizSessionHandler implements ICommandHandler<StartQuizSessionCommand> {
  constructor(
    @InjectModel(Quiz.name) private readonly quizModel: Model<Quiz>,
    @InjectModel(Question.name) private readonly questionModel: Model<Question>,
    @InjectModel(QuizSession.name)
    private readonly sessionModel: Model<QuizSession>,
    private readonly progression: ProgressionService,
    private readonly queryBus: QueryBus,
  ) {}

  async execute({
    quizId,
    user,
    assignmentId,
  }: StartQuizSessionCommand): Promise<SessionView> {
    const quiz = await this.quizModel.findById(quizId).lean();
    if (assignmentId) {
      // Homework: being assigned is the permission; no quest-map lock.
      if (!quiz) throw new NotFoundException('Không tìm thấy bài quiz');
      await this.queryBus.execute(
        new AssignmentPlayAccessQuery(assignmentId, quizId, user.userId),
      );
    } else {
      assertCanSeeQuiz(user, quiz);
      if (!(await this.progression.isUnlocked(user, quiz))) {
        throw new ForbiddenException(
          'Trạm này chưa mở khoá. Em hãy vượt qua trạm trước nhé! 🔒',
        );
      }
    }

    // No practice of a quiz while its exam is open: it would show answers (E11).
    if (
      await this.queryBus.execute(
        new ActiveExamOnQuizQuery(user.userId, quiz._id.toString()),
      )
    ) {
      throw new ConflictException(
        'Em đang làm bài kiểm tra của bài này. Làm xong rồi luyện tập nhé!',
      );
    }

    const key = {
      studentId: new Types.ObjectId(user.userId),
      quizId: quiz._id,
      assignmentId: assignmentId ? new Types.ObjectId(assignmentId) : null,
    };
    // Resume the open session if there is one; otherwise start a new one.
    // upsert + unique index keeps it to one session even on double clicks.
    const session = await this.sessionModel
      .findOneAndUpdate(
        key,
        { $setOnInsert: key },
        { upsert: true, returnDocument: 'after' },
      )
      .lean();

    const questions = await this.questionModel
      .find({ _id: { $in: session.answers.map((a) => a.questionId) } })
      .lean();
    return toSessionView(session, questions);
  }
}
