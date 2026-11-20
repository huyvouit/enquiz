import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AssignmentsModule } from '../assignments/assignments.module.js';
import { ClassesModule } from '../classes/classes.module.js';
import { ProgressModule } from '../progress/progress.module.js';
import { QuestionsModule } from '../questions/questions.module.js';
import { QuizzesModule } from '../quizzes/quizzes.module.js';
import { UsersModule } from '../users/users.module.js';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';
import { ReportExportService } from './export/report-export.service.js';
import {
  AssignmentHeatmapHandler,
  ClassOverviewHandler,
  ClassQuizHeatmapHandler,
  ExportAssignmentHandler,
  ExportGradebookHandler,
  ExportStudentReportHandler,
  GradebookHandler,
  StudentReportHandler,
  TopicHeatmapHandler,
} from './queries/analytics.handlers.js';

/** Teacher analytics and exports (plan 3.3). Read-only: queries only. */
@Module({
  imports: [
    CqrsModule,
    UsersModule,
    ClassesModule,
    QuestionsModule,
    QuizzesModule,
    ProgressModule,
    AssignmentsModule,
  ],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    ReportExportService,
    ClassOverviewHandler,
    TopicHeatmapHandler,
    AssignmentHeatmapHandler,
    ClassQuizHeatmapHandler,
    StudentReportHandler,
    GradebookHandler,
    ExportGradebookHandler,
    ExportAssignmentHandler,
    ExportStudentReportHandler,
  ],
})
export class AnalyticsModule {}
