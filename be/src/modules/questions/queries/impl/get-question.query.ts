import { Query } from '@nestjs/cqrs';
import type { QuestionView } from '../../questions.mapper.js';

export class GetQuestionQuery extends Query<QuestionView> {
  constructor(public readonly id: string) {
    super();
  }
}
