import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';
import { ClassesModule } from '../classes/classes.module.js';
import { ProgressModule } from '../progress/progress.module.js';
import { QuizzesModule } from '../quizzes/quizzes.module.js';
import { UsersModule } from '../users/users.module.js';
import { AssignmentSubmissionsService } from './assignment-submissions.service.js';
import { AssignmentsController } from './assignments.controller.js';
import {
  CreateAssignmentHandler,
  DeleteAssignmentHandler,
  UpdateAssignmentHandler,
} from './commands/handlers/assignment.handlers.js';
import {
  AddJoinersToAssignmentsHandler,
  RemoveLeaverFromAssignmentsHandler,
} from './commands/handlers/class-membership.handlers.js';
import { AssignmentCreatedLogHandler } from './events/assignment.events.js';
import {
  AnswersHiddenUntilHandler,
  AssignedQuizIdsHandler,
  AssignmentPlayAccessHandler,
} from './queries/handlers/assignment-access.handlers.js';
import {
  GetAssignmentDetailHandler,
  ListClassAssignmentsHandler,
  MyAssignmentsHandler,
  MyRemindersHandler,
} from './queries/handlers/assignment-views.handlers.js';
import { Assignment, AssignmentSchema } from './schemas/assignment.schema.js';

/**
 * Homework (plan 3.2). Depends on Classes, Quizzes and Progress models;
 * Progress and Quizzes reach back only through the QueryBus
 * (AssignmentPlayAccessQuery, AssignedQuizIdsQuery) to avoid a cycle.
 */
@Module({
  imports: [
    CqrsModule,
    UsersModule,
    ClassesModule,
    QuizzesModule,
    ProgressModule,
    MongooseModule.forFeature([
      { name: Assignment.name, schema: AssignmentSchema },
    ]),
  ],
  controllers: [AssignmentsController],
  providers: [
    AssignmentSubmissionsService,
    // Commands
    CreateAssignmentHandler,
    UpdateAssignmentHandler,
    DeleteAssignmentHandler,
    AddJoinersToAssignmentsHandler,
    RemoveLeaverFromAssignmentsHandler,
    // Queries
    ListClassAssignmentsHandler,
    GetAssignmentDetailHandler,
    MyAssignmentsHandler,
    MyRemindersHandler,
    AssignedQuizIdsHandler,
    AssignmentPlayAccessHandler,
    AnswersHiddenUntilHandler,
    // Events
    AssignmentCreatedLogHandler,
  ],
  exports: [MongooseModule, AssignmentSubmissionsService],
})
export class AssignmentsModule {}
