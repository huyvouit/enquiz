import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { assertValidQuestionContent } from '../../question-content.validator.js';
import { questionFieldsFromDto } from '../../question-fields.js';
import { QuestionView, toQuestionView } from '../../questions.mapper.js';
import { Question } from '../../schemas/question.schema.js';
import { CreateQuestionCommand } from '../impl/create-question.command.js';

@CommandHandler(CreateQuestionCommand)
export class CreateQuestionHandler implements ICommandHandler<CreateQuestionCommand> {
  constructor(
    @InjectModel(Question.name) private readonly questionModel: Model<Question>,
  ) {}

  async execute({ dto, user }: CreateQuestionCommand): Promise<QuestionView> {
    const content = assertValidQuestionContent(dto);
    const created = await this.questionModel.create({
      ...questionFieldsFromDto(dto),
      ...content,
      createdBy: new Types.ObjectId(user.userId),
    });
    return toQuestionView(created.toObject());
  }
}
