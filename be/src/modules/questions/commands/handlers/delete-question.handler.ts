import { ConflictException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler, QueryBus } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { assertCanModify } from '../../../../common/utils/ownership.js';
import { CountQuizzesUsingQuestionQuery } from '../../../quizzes/queries/impl/count-quizzes-using-question.query.js';
import { Question } from '../../schemas/question.schema.js';
import { DeleteQuestionCommand } from '../impl/delete-question.command.js';

@CommandHandler(DeleteQuestionCommand)
export class DeleteQuestionHandler implements ICommandHandler<DeleteQuestionCommand> {
  constructor(
    @InjectModel(Question.name) private readonly questionModel: Model<Question>,
    // Asks the Quizzes module through the bus instead of importing its model,
    // so the two modules stay decoupled.
    private readonly queryBus: QueryBus,
  ) {}

  async execute({ id, user }: DeleteQuestionCommand): Promise<{ id: string }> {
    const existing = await this.questionModel.findById(id).lean();
    if (!existing) throw new NotFoundException('Không tìm thấy câu hỏi');
    assertCanModify(user, existing.createdBy);

    const usedBy = await this.queryBus.execute(
      new CountQuizzesUsingQuestionQuery(id),
    );
    if (usedBy > 0) {
      throw new ConflictException(
        `Câu hỏi đang được dùng trong ${usedBy} bài quiz, hãy gỡ khỏi quiz trước khi xoá`,
      );
    }

    await this.questionModel.deleteOne({ _id: id });
    return { id };
  }
}
