import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler, QueryBus } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { seededRandom, shuffle } from '../../../../common/utils/shuffle.js';
import { ClassAccessQuery } from '../../../classes/queries/impl/class-membership.queries.js';
import { normalize } from '../../../progress/grading/graders.js';
import { QuestionType } from '../../../questions/question-types.js';
import { Question } from '../../../questions/schemas/question.schema.js';
import { canSeeQuiz } from '../../../quizzes/quiz-access.js';
import { orderByIds, toPlayQuestion } from '../../../quizzes/quizzes.mapper.js';
import { Quiz } from '../../../quizzes/schemas/quiz.schema.js';
import { AUTO_ADVANCE_SEC } from '../../dto/live.dto.js';
import { LiveRoomRegistry } from '../../live-room.registry.js';
import {
  CreatedLiveMatch,
  CreateLiveMatchCommand,
} from '../impl/live.commands.js';

@CommandHandler(CreateLiveMatchCommand)
export class CreateLiveMatchHandler implements ICommandHandler<CreateLiveMatchCommand> {
  constructor(
    @InjectModel(Quiz.name) private readonly quizModel: Model<Quiz>,
    @InjectModel(Question.name) private readonly questionModel: Model<Question>,
    private readonly registry: LiveRoomRegistry,
    private readonly queryBus: QueryBus,
  ) {}

  async execute({
    dto,
    user,
  }: CreateLiveMatchCommand): Promise<CreatedLiveMatch> {
    // Own quizzes (drafts too), shared ones and system ones (L3).
    const quiz = await this.quizModel.findById(dto.quizId).lean();
    if (!quiz || !canSeeQuiz(user, quiz)) {
      throw new NotFoundException('Không tìm thấy bài quiz');
    }
    const classAccess = dto.classId
      ? await this.queryBus.execute(
          new ClassAccessQuery(dto.classId, user, 'manage'),
        )
      : null;

    // Multiple choice only (L1): one tap per question.
    let questions = orderByIds(
      quiz.questionIds,
      await this.questionModel
        .find({
          _id: { $in: quiz.questionIds },
          type: QuestionType.MULTIPLE_CHOICE,
        })
        .lean(),
    );
    if (questions.length === 0) {
      throw new BadRequestException(
        'Quiz này không có câu trắc nghiệm nào để chơi Đấu trường',
      );
    }
    if (quiz.settings?.shuffleQuestions) questions = shuffle(questions);

    const matchId = new Types.ObjectId().toString();
    // Option order is fixed once for the whole room: every screen agrees.
    const playQuestions = questions.map((q) =>
      toPlayQuestion(q, seededRandom(`${matchId}:${q._id.toString()}`)),
    );
    const liveQuestions = playQuestions.map((pq, i) => {
      const options = pq.options ?? [];
      return {
        id: pq.id,
        optionCount: options.length,
        correctIndex: options.findIndex(
          (o) => normalize(o) === normalize(String(questions[i].correctAnswer)),
        ),
      };
    });

    const room = this.registry.open({
      matchId,
      hostId: user.userId,
      questions: liveQuestions,
      settings: {
        questionTimeSec: dto.questionTimeSec ?? 20,
        autoAdvanceSec: dto.autoAdvance ? AUTO_ADVANCE_SEC : null,
      },
      meta: {
        quiz: {
          id: quiz._id.toString(),
          title: quiz.title,
          coverEmoji: quiz.coverEmoji,
        },
        playQuestions,
        classId: classAccess?.id ?? null,
        className: classAccess?.name ?? null,
        allowedUserIds: classAccess?.studentIds ?? null,
        allowGuests: dto.allowGuests ?? false,
        skippedCount: quiz.questionIds.length - questions.length,
        guestTokens: {},
        startedAt: null,
        saving: null,
      },
    });
    return {
      matchId,
      pin: room.pin,
      playableCount: questions.length,
      skippedCount: quiz.questionIds.length - questions.length,
    };
  }
}
