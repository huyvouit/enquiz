import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { assertCanModify } from '../../../../common/utils/ownership.js';
import { QuizAuthorsService } from '../../quiz-authors.service.js';
import { QuizQuestionsValidator } from '../../quiz-questions.validator.js';
import { QuizSummary, toQuizSummary } from '../../quizzes.mapper.js';
import { Quiz } from '../../schemas/quiz.schema.js';
import { UpdateQuizCommand } from '../impl/update-quiz.command.js';
import { quizFieldsFromDto } from './create-quiz.handler.js';

@CommandHandler(UpdateQuizCommand)
export class UpdateQuizHandler implements ICommandHandler<UpdateQuizCommand> {
  constructor(
    @InjectModel(Quiz.name) private readonly quizModel: Model<Quiz>,
    private readonly questionsValidator: QuizQuestionsValidator,
    private readonly authors: QuizAuthorsService,
  ) {}

  async execute({ id, dto, user }: UpdateQuizCommand): Promise<QuizSummary> {
    const quiz = await this.quizModel.findById(id);
    if (!quiz) throw new NotFoundException('Không tìm thấy bài quiz');
    assertCanModify(user, quiz.createdBy);

    const questionIds = await this.questionsValidator.toObjectIds(
      dto.questionIds,
    );
    quiz.set({ ...quizFieldsFromDto(dto), questionIds });
    await quiz.save();

    const authors = await this.authors.resolve([quiz.createdBy]);
    return toQuizSummary(
      quiz.toObject(),
      quiz.createdBy ? (authors.get(quiz.createdBy.toString()) ?? null) : null,
    );
  }
}
