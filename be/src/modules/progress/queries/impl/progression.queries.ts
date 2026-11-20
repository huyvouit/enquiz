import { Query } from '@nestjs/cqrs';
import type { Types } from 'mongoose';
import type { AuthUser } from '../../../../common/types/auth-user.js';
import type { LeaderboardPeriod } from '../../progression/progression.rules.js';
import type {
  LeaderboardView,
  QuestMapView,
} from '../handlers/progression.views.js';

/** The student's quest map for one grade. */
export class GetQuestMapQuery extends Query<QuestMapView> {
  constructor(
    public readonly user: AuthUser,
    public readonly gradeLevel?: number,
  ) {
    super();
  }
}

export class GetLeaderboardQuery extends Query<LeaderboardView> {
  constructor(
    public readonly user: AuthUser,
    public readonly period: LeaderboardPeriod,
    public readonly gradeLevel?: number,
    public readonly scope: 'grade' | 'class' = 'grade',
    public readonly classId?: string,
  ) {
    super();
  }
}

/**
 * Asked by the Quizzes module before serving a quiz to play,
 * so it does not need to know the progression rules.
 */
export class IsQuizUnlockedQuery extends Query<boolean> {
  constructor(
    public readonly user: AuthUser,
    public readonly quiz: { _id: Types.ObjectId; gradeLevel: number },
  ) {
    super();
  }
}
