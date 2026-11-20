import { NotFoundException } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Question } from '../../../questions/schemas/question.schema.js';
import { orderByIds } from '../../../quizzes/quizzes.mapper.js';
import { Quiz } from '../../../quizzes/schemas/quiz.schema.js';
import { QuizCompletedEvent } from '../../events/impl/quiz-completed.event.js';
import { computeScore } from '../../grading/graders.js';
import { AttemptResult, toAttemptResult } from '../../progress.mapper.js';
import { ProgressionService } from '../../progression/progression.service.js';
import { QuizSession } from '../../schemas/quiz-session.schema.js';
import { FinishQuizSessionCommand } from '../impl/session.commands.js';
import { loadOwnSession } from './session-loader.js';

@CommandHandler(FinishQuizSessionCommand)
export class FinishQuizSessionHandler implements ICommandHandler<FinishQuizSessionCommand> {
  constructor(
    @InjectModel(Quiz.name) private readonly quizModel: Model<Quiz>,
    @InjectModel(Question.name) private readonly questionModel: Model<Question>,
    @InjectModel(QuizSession.name)
    private readonly sessionModel: Model<QuizSession>,
    private readonly progression: ProgressionService,
    private readonly eventBus: EventBus,
  ) {}

  async execute({
    sessionId,
    user,
  }: FinishQuizSessionCommand): Promise<AttemptResult> {
    const session = await loadOwnSession(this.sessionModel, sessionId, user);

    // Claim the session first so a double click cannot save two attempts.
    const claimed = await this.sessionModel.deleteOne({ _id: session._id });
    if (claimed.deletedCount === 0) {
      throw new NotFoundException('Bài này đã được nộp rồi');
    }

    const quiz = await this.quizModel.findById(session.quizId).lean();
    if (!quiz) throw new NotFoundException('Bài quiz đã bị xoá');

    const questions = orderByIds(
      quiz.questionIds,
      await this.questionModel.find({ _id: { $in: quiz.questionIds } }).lean(),
    );
    const answered = new Map(
      session.answers.map((a) => [a.questionId.toString(), a]),
    );
    // Unanswered questions count as wrong.
    const details = questions.map(
      (q) =>
        answered.get(q._id.toString()) ?? {
          questionId: q._id,
          studentAnswer: null,
          isCorrect: false,
        },
    );
    const correctCount = details.filter((d) => d.isCorrect).length;
    const score = computeScore(correctCount, questions.length);
    const durationSec = Math.round(
      (Date.now() - new Date(session.startedAt).getTime()) / 1000,
    );

    const { progress, progression } = await this.progression.recordAttempt({
      studentId: user.userId,
      quiz,
      assignmentId: session.assignmentId ?? null,
      details,
      correctCount,
      score,
      durationSec,
    });

    this.eventBus.publish(
      new QuizCompletedEvent(
        progress._id.toString(),
        user.userId,
        quiz._id.toString(),
        score,
        progression.leveledUp,
        progression.levelAfter,
      ),
    );

    return toAttemptResult(progress.toObject(), quiz, questions, progression);
  }
}
