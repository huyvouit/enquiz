import { BadRequestException } from '@nestjs/common';
import {
  Command,
  CommandHandler,
  ICommandHandler,
  IQueryHandler,
  Query,
  QueryHandler,
} from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsMongoId,
  Max,
  Min,
} from 'class-validator';
import { Model, Types } from 'mongoose';
import { QuizSummary, toQuizSummary } from './quizzes.mapper.js';
import { Quiz } from './schemas/quiz.schema.js';

/** Admin: the system quizzes of a grade (any status) in quest-map order. */
export class MapOrderQuery extends Query<QuizSummary[]> {
  constructor(public readonly gradeLevel: number) {
    super();
  }
}

export class GradeLevelQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  gradeLevel: number;
}

export class ReorderMapDto extends GradeLevelQueryDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsMongoId({ each: true })
  quizIds: string[];
}

/** Sets mapOrder 1..n in the given order; system quizzes not listed go last. */
export class ReorderMapCommand extends Command<QuizSummary[]> {
  constructor(
    public readonly gradeLevel: number,
    public readonly quizIds: string[],
  ) {
    super();
  }
}

async function loadMap(model: Model<Quiz>, gradeLevel: number) {
  return model
    .find({ createdBy: null, gradeLevel })
    .sort({ mapOrder: 1, createdAt: 1, _id: 1 })
    .lean();
}

@QueryHandler(MapOrderQuery)
export class MapOrderHandler implements IQueryHandler<MapOrderQuery> {
  constructor(
    @InjectModel(Quiz.name) private readonly quizModel: Model<Quiz>,
  ) {}

  async execute({ gradeLevel }: MapOrderQuery): Promise<QuizSummary[]> {
    return (await loadMap(this.quizModel, gradeLevel)).map((q) =>
      toQuizSummary(q, null),
    );
  }
}

@CommandHandler(ReorderMapCommand)
export class ReorderMapHandler implements ICommandHandler<ReorderMapCommand> {
  constructor(
    @InjectModel(Quiz.name) private readonly quizModel: Model<Quiz>,
  ) {}

  async execute({
    gradeLevel,
    quizIds,
  }: ReorderMapCommand): Promise<QuizSummary[]> {
    const current = await loadMap(this.quizModel, gradeLevel);
    const known = new Set(current.map((q) => q._id.toString()));
    if (quizIds.some((id) => !known.has(id))) {
      throw new BadRequestException(
        'Chỉ sắp xếp được các quiz hệ thống của khối này',
      );
    }
    const listed = new Set(quizIds);
    const order = [
      ...quizIds,
      ...current.map((q) => q._id.toString()).filter((id) => !listed.has(id)),
    ];
    if (order.length > 0) {
      await this.quizModel.bulkWrite(
        order.map((id, i) => ({
          updateOne: {
            filter: { _id: new Types.ObjectId(id) },
            update: { $set: { mapOrder: i + 1 } },
          },
        })),
      );
    }
    return (await loadMap(this.quizModel, gradeLevel)).map((q) =>
      toQuizSummary(q, null),
    );
  }
}
