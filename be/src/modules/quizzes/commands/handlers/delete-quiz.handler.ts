import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { assertCanModify } from '../../../../common/utils/ownership.js';
import { Quiz } from '../../schemas/quiz.schema.js';
import { DeleteQuizCommand } from '../impl/delete-quiz.command.js';

/**
 * Past attempts (student_progress) are kept on purpose: students' history
 * still shows them, labelled as a deleted quiz.
 */
@CommandHandler(DeleteQuizCommand)
export class DeleteQuizHandler implements ICommandHandler<DeleteQuizCommand> {
  constructor(
    @InjectModel(Quiz.name) private readonly quizModel: Model<Quiz>,
  ) {}

  async execute({ id, user }: DeleteQuizCommand): Promise<{ id: string }> {
    const quiz = await this.quizModel.findById(id).lean();
    if (!quiz) throw new NotFoundException('Không tìm thấy bài quiz');
    assertCanModify(user, quiz.createdBy);
    await this.quizModel.deleteOne({ _id: id });
    return { id };
  }
}
