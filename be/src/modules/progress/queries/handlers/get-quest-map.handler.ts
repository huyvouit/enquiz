import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../../../users/schemas/user.schema.js';
import { PASS_SCORE } from '../../progression/progression.rules.js';
import { ProgressionService } from '../../progression/progression.service.js';
import { GetQuestMapQuery } from '../impl/progression.queries.js';
import { QuestMapView } from './progression.views.js';

@QueryHandler(GetQuestMapQuery)
export class GetQuestMapHandler implements IQueryHandler<GetQuestMapQuery> {
  constructor(
    private readonly progression: ProgressionService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async execute({ user, gradeLevel }: GetQuestMapQuery): Promise<QuestMapView> {
    const me = await this.userModel
      .findById(user.userId, { studentProfile: 1 })
      .lean();
    const grade = gradeLevel ?? me?.studentProfile?.gradeLevel ?? 1;
    const stations = await this.progression.gradeMap(user, grade);

    return {
      gradeLevel: grade,
      level: me?.studentProfile?.level ?? 1,
      xp: me?.studentProfile?.xp ?? 0,
      passScore: PASS_SCORE,
      stations: stations.map(({ quiz, status, bestScore }) => ({
        id: quiz._id.toString(),
        title: quiz.title,
        description: quiz.description,
        topic: quiz.topic,
        coverEmoji: quiz.coverEmoji,
        questionCount: quiz.questionIds.length,
        status,
        bestScore,
      })),
    };
  }
}
