import { Logger } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { QuizCompletedEvent } from '../impl/quiz-completed.event.js';

/** Logs completions. Add more handlers for new side effects. */
@EventsHandler(QuizCompletedEvent)
export class QuizCompletedLogHandler implements IEventHandler<QuizCompletedEvent> {
  private readonly logger = new Logger(QuizCompletedLogHandler.name);

  handle(e: QuizCompletedEvent) {
    this.logger.log(
      `Student ${e.studentId} finished quiz ${e.quizId}: score ${e.score}` +
        (e.leveledUp ? `, level up -> ${e.levelAfter}` : ''),
    );
  }
}
