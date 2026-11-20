import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { assertCanModify } from '../../../../common/utils/ownership.js';
import { assertValidQuestionContent } from '../../question-content.validator.js';
import { questionFieldsFromDto } from '../../question-fields.js';
import { QuestionView, toQuestionView } from '../../questions.mapper.js';
import { Question } from '../../schemas/question.schema.js';
import { UpdateQuestionCommand } from '../impl/update-question.command.js';

@CommandHandler(UpdateQuestionCommand)
export class UpdateQuestionHandler implements ICommandHandler<UpdateQuestionCommand> {
  constructor(
    @InjectModel(Question.name) private readonly questionModel: Model<Question>,
  ) {}

  async execute({
    id,
    dto,
    user,
  }: UpdateQuestionCommand): Promise<QuestionView> {
    const existing = await this.questionModel.findById(id);
    if (!existing) throw new NotFoundException('Không tìm thấy câu hỏi');
    assertCanModify(user, existing.createdBy);

    const content = assertValidQuestionContent(dto);
    existing.set({
      ...questionFieldsFromDto(dto),
      ...content,
    });
    await existing.save();
    return toQuestionView(existing.toObject());
  }
}
