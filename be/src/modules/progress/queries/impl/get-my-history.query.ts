import { Query } from '@nestjs/cqrs';
import type { AttemptSummary } from '../../progress.mapper.js';

export class GetMyHistoryQuery extends Query<AttemptSummary[]> {
  constructor(public readonly studentId: string) {
    super();
  }
}
