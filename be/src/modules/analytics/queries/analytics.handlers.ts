import { IQueryHandler, QueryBus, QueryHandler } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { AuthUser } from '../../../common/types/auth-user.js';
import { loadManagedAssignment } from '../../assignments/assignment-access.js';
import { GetAssignmentDetailQuery } from '../../assignments/queries/impl/assignment.queries.js';
import { Assignment } from '../../assignments/schemas/assignment.schema.js';
import {
  ClassAccess,
  ClassAccessQuery,
} from '../../classes/queries/impl/class-membership.queries.js';
import { resolveRange } from '../analytics-rules.js';
import { AnalyticsService } from '../analytics.service.js';
import type {
  ClassOverview,
  Gradebook,
  QuestionHeatmap,
  StudentReport,
  TopicHeatmap,
} from '../analytics.views.js';
import {
  ExportFile,
  ReportExportService,
} from '../export/report-export.service.js';
import {
  AssignmentHeatmapQuery,
  ClassOverviewQuery,
  ClassQuizHeatmapQuery,
  ExportAssignmentQuery,
  ExportGradebookQuery,
  ExportStudentReportQuery,
  GradebookQuery,
  StudentReportQuery,
  TopicHeatmapQuery,
} from './analytics.queries.js';

/** Every analytics read starts here: only the class's teacher or an admin. */
const managed = (bus: QueryBus, classId: string, user: AuthUser) =>
  bus.execute(
    new ClassAccessQuery(classId, user, 'manage'),
  ) as Promise<ClassAccess>;

@QueryHandler(ClassOverviewQuery)
export class ClassOverviewHandler implements IQueryHandler<ClassOverviewQuery> {
  constructor(
    private readonly bus: QueryBus,
    private readonly analytics: AnalyticsService,
  ) {}

  async execute(q: ClassOverviewQuery): Promise<ClassOverview> {
    const range = resolveRange(q.range.from, q.range.to);
    return this.analytics.overview(
      await managed(this.bus, q.classId, q.user),
      range,
    );
  }
}

@QueryHandler(TopicHeatmapQuery)
export class TopicHeatmapHandler implements IQueryHandler<TopicHeatmapQuery> {
  constructor(
    private readonly bus: QueryBus,
    private readonly analytics: AnalyticsService,
  ) {}

  async execute(q: TopicHeatmapQuery): Promise<TopicHeatmap> {
    const range = resolveRange(q.range.from, q.range.to);
    return this.analytics.topicHeatmap(
      await managed(this.bus, q.classId, q.user),
      range,
    );
  }
}

@QueryHandler(AssignmentHeatmapQuery)
export class AssignmentHeatmapHandler implements IQueryHandler<AssignmentHeatmapQuery> {
  constructor(
    @InjectModel(Assignment.name)
    private readonly assignmentModel: Model<Assignment>,
    private readonly bus: QueryBus,
    private readonly analytics: AnalyticsService,
  ) {}

  async execute(q: AssignmentHeatmapQuery): Promise<QuestionHeatmap> {
    const { assignment, classAccess } = await loadManagedAssignment(
      this.assignmentModel,
      this.bus,
      q.assignmentId,
      q.user,
    );
    return this.analytics.assignmentHeatmap(assignment, classAccess);
  }
}

@QueryHandler(ClassQuizHeatmapQuery)
export class ClassQuizHeatmapHandler implements IQueryHandler<ClassQuizHeatmapQuery> {
  constructor(
    private readonly bus: QueryBus,
    private readonly analytics: AnalyticsService,
  ) {}

  async execute(q: ClassQuizHeatmapQuery): Promise<QuestionHeatmap> {
    return this.analytics.quizHeatmap(
      q.quizId,
      await managed(this.bus, q.classId, q.user),
    );
  }
}

@QueryHandler(StudentReportQuery)
export class StudentReportHandler implements IQueryHandler<StudentReportQuery> {
  constructor(
    private readonly bus: QueryBus,
    private readonly analytics: AnalyticsService,
  ) {}

  async execute(q: StudentReportQuery): Promise<StudentReport> {
    const range = resolveRange(q.range.from, q.range.to);
    return this.analytics.studentReport(
      await managed(this.bus, q.classId, q.user),
      q.studentId,
      range,
    );
  }
}

@QueryHandler(GradebookQuery)
export class GradebookHandler implements IQueryHandler<GradebookQuery> {
  constructor(
    private readonly bus: QueryBus,
    private readonly analytics: AnalyticsService,
  ) {}

  async execute(q: GradebookQuery): Promise<Gradebook> {
    const range = resolveRange(q.range.from, q.range.to);
    return this.analytics.gradebook(
      await managed(this.bus, q.classId, q.user),
      range,
    );
  }
}

// ---------- Exports reuse the very same queries as the screens ----------

@QueryHandler(ExportGradebookQuery)
export class ExportGradebookHandler implements IQueryHandler<ExportGradebookQuery> {
  constructor(
    private readonly bus: QueryBus,
    private readonly exporter: ReportExportService,
  ) {}

  async execute(q: ExportGradebookQuery): Promise<ExportFile> {
    const data = await this.bus.execute(
      new GradebookQuery(q.classId, q.user, q.range),
    );
    return this.exporter.gradebook(data, q.format);
  }
}

@QueryHandler(ExportAssignmentQuery)
export class ExportAssignmentHandler implements IQueryHandler<ExportAssignmentQuery> {
  constructor(
    private readonly bus: QueryBus,
    private readonly exporter: ReportExportService,
  ) {}

  async execute(q: ExportAssignmentQuery): Promise<ExportFile> {
    const [detail, heatmap] = await Promise.all([
      this.bus.execute(new GetAssignmentDetailQuery(q.assignmentId, q.user)),
      this.bus.execute(new AssignmentHeatmapQuery(q.assignmentId, q.user)),
    ]);
    return this.exporter.assignment(detail, heatmap, q.format);
  }
}

@QueryHandler(ExportStudentReportQuery)
export class ExportStudentReportHandler implements IQueryHandler<ExportStudentReportQuery> {
  constructor(
    private readonly bus: QueryBus,
    private readonly exporter: ReportExportService,
  ) {}

  async execute(q: ExportStudentReportQuery): Promise<ExportFile> {
    const report = await this.bus.execute(
      new StudentReportQuery(q.classId, q.studentId, q.user, q.range),
    );
    return this.exporter.studentReport(report);
  }
}
