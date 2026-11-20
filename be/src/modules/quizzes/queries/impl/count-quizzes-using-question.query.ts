import { Query } from '@nestjs/cqrs';

/** Used by the Questions module before deleting a question. */
export class CountQuizzesUsingQuestionQuery extends Query<number> {
  constructor(public readonly questionId: string) {
    super();
  }
}
