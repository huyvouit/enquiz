import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Question } from '../questions/schemas/question.schema.js';

/** Ensures every id in a quiz points to an existing question. */
@Injectable()
export class QuizQuestionsValidator {
  constructor(
    @InjectModel(Question.name) private readonly questionModel: Model<Question>,
  ) {}

  async toObjectIds(questionIds: string[]): Promise<Types.ObjectId[]> {
    const found = await this.questionModel.countDocuments({
      _id: { $in: questionIds },
    });
    if (found !== questionIds.length) {
      throw new BadRequestException(
        'Một số câu hỏi không tồn tại trong kho câu hỏi',
      );
    }
    return questionIds.map((id) => new Types.ObjectId(id));
  }
}
