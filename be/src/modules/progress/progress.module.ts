import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';
import { QuestionsModule } from '../questions/questions.module.js';
import { QuizzesModule } from '../quizzes/quizzes.module.js';
import { UsersModule } from '../users/users.module.js';
import { AnswerQuestionHandler } from './commands/handlers/answer-question.handler.js';
import { FinishQuizSessionHandler } from './commands/handlers/finish-quiz-session.handler.js';
import { StartQuizSessionHandler } from './commands/handlers/start-quiz-session.handler.js';
import { QuizCompletedLogHandler } from './events/handlers/quiz-completed.handler.js';
import { ProgressController } from './progress.controller.js';
import { ProgressionService } from './progression/progression.service.js';
import { GetAttemptHandler } from './queries/handlers/get-attempt.handler.js';
import { GetLeaderboardHandler } from './queries/handlers/get-leaderboard.handler.js';
import { GetMyHistoryHandler } from './queries/handlers/get-my-history.handler.js';
import { GetQuestMapHandler } from './queries/handlers/get-quest-map.handler.js';
import { GetQuizResultsHandler } from './queries/handlers/get-quiz-results.handler.js';
import { IsQuizUnlockedHandler } from './queries/handlers/is-quiz-unlocked.handler.js';
import {
  QuizSession,
  QuizSessionSchema,
} from './schemas/quiz-session.schema.js';
import {
  StudentProgress,
  StudentProgressSchema,
} from './schemas/student-progress.schema.js';

@Module({
  imports: [
    CqrsModule,
    UsersModule,
    QuestionsModule,
    QuizzesModule,
    MongooseModule.forFeature([
      { name: StudentProgress.name, schema: StudentProgressSchema },
      { name: QuizSession.name, schema: QuizSessionSchema },
    ]),
  ],
  controllers: [ProgressController],
  providers: [
    ProgressionService,
    // Commands
    StartQuizSessionHandler,
    AnswerQuestionHandler,
    FinishQuizSessionHandler,
    // Queries
    GetQuestMapHandler,
    GetLeaderboardHandler,
    IsQuizUnlockedHandler,
    GetMyHistoryHandler,
    GetAttemptHandler,
    GetQuizResultsHandler,
    // Events
    QuizCompletedLogHandler,
  ],
  // Assignments and Analytics read attempts and the quest map.
  exports: [MongooseModule, ProgressionService],
})
export class ProgressModule {}
