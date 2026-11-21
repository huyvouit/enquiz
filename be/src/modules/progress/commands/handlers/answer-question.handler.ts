import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Question } from '../../../questions/schemas/question.schema.js';
import { Quiz } from '../../../quizzes/schemas/quiz.schema.js';
import { cleanAnswer } from '../../grading/clean-answer.js';
import { gradeAnswer } from '../../grading/graders.js';
import { AnswerFeedback, toAnswerFeedback } from '../../progress.mapper.js';
import { QuizSession } from '../../schemas/quiz-session.schema.js';
import { AnswerQuestionCommand } from '../impl/session.commands.js';
import { loadOwnSession } from './session-loader.js';

@CommandHandler(AnswerQuestionCommand)
export class AnswerQuestionHandler implements ICommandHandler<AnswerQuestionCommand> {
  constructor(
    @InjectModel(Quiz.name) private readonly quizModel: Model<Quiz>,
    @InjectModel(Question.name) private readonly questionModel: Model<Question>,
    @InjectModel(QuizSession.name)
    private readonly sessionModel: Model<QuizSession>,
  ) {}

  async execute({
    sessionId,
    questionId,
    studentAnswer,
    user,
  }: AnswerQuestionCommand): Promise<
    AnswerFeedback & { alreadyAnswered: boolean }
  > {
    const session = await loadOwnSession(this.sessionModel, sessionId, user);
    const qid = new Types.ObjectId(questionId);

    const quiz = await this.quizModel
      .findById(session.quizId, { questionIds: 1 })
      .lean();
    if (!quiz?.questionIds.some((id) => id.equals(qid))) {
      throw new BadRequestException('Câu hỏi không thuộc bài này');
    }
    const question = await this.questionModel.findById(qid).lean();
    if (!question) throw new BadRequestException('Câu hỏi không còn tồn tại');

    const existing = session.answers.find((a) => a.questionId.equals(qid));
    if (existing) {
      return { ...toAnswerFeedback(existing, question), alreadyAnswered: true };
    }

    // Only a known shape of bounded size is graded and stored (launch A5):
    // anything else is kept as null, i.e. a wrong answer.
    const given = cleanAnswer(studentAnswer);
    const answer = {
      questionId: qid,
      studentAnswer: given,
      isCorrect: given !== null && gradeAnswer(question, given),
    };
    // Conditional push: if two requests race, only the first answer is kept.
    const res = await this.sessionModel.updateOne(
      { _id: session._id, 'answers.questionId': { $ne: qid } },
      { $push: { answers: answer } },
    );
    if (res.modifiedCount === 0) {
      const fresh = await loadOwnSession(this.sessionModel, sessionId, user);
      const stored = fresh.answers.find((a) => a.questionId.equals(qid));
      if (stored) {
        return { ...toAnswerFeedback(stored, question), alreadyAnswered: true };
      }
    }
    return { ...toAnswerFeedback(answer, question), alreadyAnswered: false };
  }
}
