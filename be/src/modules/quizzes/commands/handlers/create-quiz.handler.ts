import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role } from '../../../../common/enums/role.enum.js';
import { QuizDto } from '../../dto/quiz.dto.js';
import { QuizAuthorsService } from '../../quiz-authors.service.js';
import { QuizQuestionsValidator } from '../../quiz-questions.validator.js';
import { QuizSummary, toQuizSummary } from '../../quizzes.mapper.js';
import { Quiz, QuizStatus } from '../../schemas/quiz.schema.js';
import { CreateQuizCommand } from '../impl/create-quiz.command.js';

/** Maps the DTO onto persisted fields. Shared with the update handler. */
export function quizFieldsFromDto(dto: QuizDto) {
  return {
    title: dto.title.trim(),
    description: dto.description?.trim() || undefined,
    topic: dto.topic.trim(),
    gradeLevel: dto.gradeLevel,
    coverEmoji: dto.coverEmoji?.trim() || '📘',
    status: dto.status ?? QuizStatus.PUBLISHED,
    settings: { shuffleQuestions: dto.settings?.shuffleQuestions ?? false },
  };
}

@CommandHandler(CreateQuizCommand)
export class CreateQuizHandler implements ICommandHandler<CreateQuizCommand> {
  constructor(
    @InjectModel(Quiz.name) private readonly quizModel: Model<Quiz>,
    private readonly questionsValidator: QuizQuestionsValidator,
    private readonly authors: QuizAuthorsService,
  ) {}

  async execute({ dto, user }: CreateQuizCommand): Promise<QuizSummary> {
    const questionIds = await this.questionsValidator.toObjectIds(
      dto.questionIds,
    );
    // Admins curate the system content: their quizzes are quest-map
    // stations (createdBy = null), appended at the end of the grade's map.
    const isAdmin = user.role === Role.ADMIN;
    const createdBy = isAdmin ? null : new Types.ObjectId(user.userId);
    const created = await this.quizModel.create({
      ...quizFieldsFromDto(dto),
      questionIds,
      createdBy,
      mapOrder: isAdmin ? await this.nextMapOrder(dto.gradeLevel) : undefined,
    });
    const authors = createdBy
      ? await this.authors.resolve([createdBy])
      : new Map();
    return toQuizSummary(created.toObject(), authors.get(user.userId) ?? null);
  }

  private async nextMapOrder(gradeLevel: number): Promise<number> {
    const last = await this.quizModel
      .findOne({ createdBy: null, gradeLevel }, { mapOrder: 1 })
      .sort({ mapOrder: -1 })
      .lean();
    return (last?.mapOrder ?? 0) + 1;
  }
}
