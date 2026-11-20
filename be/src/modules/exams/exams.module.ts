import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';
import { AssignmentsModule } from '../assignments/assignments.module.js';
import { ClassesModule } from '../classes/classes.module.js';
import { ProgressModule } from '../progress/progress.module.js';
import { QuestionsModule } from '../questions/questions.module.js';
import { QuizzesModule } from '../quizzes/quizzes.module.js';
import { UsersModule } from '../users/users.module.js';
import {
  FinalizeExpiredExamsHandler,
  SaveExamDraftHandler,
  StartExamHandler,
  SubmitExamHandler,
} from './commands/handlers/exam.handlers.js';
import { ExamService } from './exam.service.js';
import { ExamsController } from './exams.controller.js';
import {
  ActiveExamOnQuizHandler,
  ExamSessionStatesHandler,
  ExamStartedHandler,
  GetExamHandler,
  GetExamIntroHandler,
} from './queries/handlers/exam.query-handlers.js';
import {
  ExamSession,
  ExamSessionSchema,
} from './schemas/exam-session.schema.js';

/**
 * Exam mode (plan 4.2, doc 14). Depends on Assignments, Progress, Quizzes,
 * Questions. Those modules reach back only through the buses
 * (FinalizeExpiredExamsCommand, ExamSessionStatesQuery,
 * ActiveExamOnQuizQuery, ExamStartedQuery) to avoid a cycle.
 */
@Module({
  imports: [
    CqrsModule,
    UsersModule,
    ClassesModule,
    QuestionsModule,
    QuizzesModule,
    ProgressModule,
    AssignmentsModule,
    MongooseModule.forFeature([
      { name: ExamSession.name, schema: ExamSessionSchema },
    ]),
  ],
  controllers: [ExamsController],
  providers: [
    ExamService,
    // Commands
    StartExamHandler,
    SaveExamDraftHandler,
    SubmitExamHandler,
    FinalizeExpiredExamsHandler,
    // Queries
    GetExamIntroHandler,
    GetExamHandler,
    ExamSessionStatesHandler,
    ActiveExamOnQuizHandler,
    ExamStartedHandler,
  ],
})
export class ExamsModule {}
