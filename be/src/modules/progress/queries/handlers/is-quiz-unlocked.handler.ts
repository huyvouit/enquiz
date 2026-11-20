import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ProgressionService } from '../../progression/progression.service.js';
import { IsQuizUnlockedQuery } from '../impl/progression.queries.js';

@QueryHandler(IsQuizUnlockedQuery)
export class IsQuizUnlockedHandler implements IQueryHandler<IsQuizUnlockedQuery> {
  constructor(private readonly progression: ProgressionService) {}

  execute({ user, quiz }: IsQuizUnlockedQuery): Promise<boolean> {
    return this.progression.isUnlocked(user, quiz);
  }
}
