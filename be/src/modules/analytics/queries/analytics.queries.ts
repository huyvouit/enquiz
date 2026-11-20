import { Query } from '@nestjs/cqrs';
import type { AuthUser } from '../../../common/types/auth-user.js';
import type {
  ClassOverview,
  Gradebook,
  QuestionHeatmap,
  StudentReport,
  TopicHeatmap,
} from '../analytics.views.js';
import type {
  ExportFile,
  ExportFormat,
} from '../export/report-export.service.js';

/** Optional range; defaults to the last 30 days (see resolveRange). */
interface RangeArgs {
  from?: Date;
  to?: Date;
}

export class ClassOverviewQuery extends Query<ClassOverview> {
  constructor(
    public readonly classId: string,
    public readonly user: AuthUser,
    public readonly range: RangeArgs,
  ) {
    super();
  }
}

export class TopicHeatmapQuery extends Query<TopicHeatmap> {
  constructor(
    public readonly classId: string,
    public readonly user: AuthUser,
    public readonly range: RangeArgs,
  ) {
    super();
  }
}

export class AssignmentHeatmapQuery extends Query<QuestionHeatmap> {
  constructor(
    public readonly assignmentId: string,
    public readonly user: AuthUser,
  ) {
    super();
  }
}

export class ClassQuizHeatmapQuery extends Query<QuestionHeatmap> {
  constructor(
    public readonly classId: string,
    public readonly quizId: string,
    public readonly user: AuthUser,
  ) {
    super();
  }
}

export class StudentReportQuery extends Query<StudentReport> {
  constructor(
    public readonly classId: string,
    public readonly studentId: string,
    public readonly user: AuthUser,
    public readonly range: RangeArgs,
  ) {
    super();
  }
}

export class GradebookQuery extends Query<Gradebook> {
  constructor(
    public readonly classId: string,
    public readonly user: AuthUser,
    public readonly range: RangeArgs,
  ) {
    super();
  }
}

// ---------- File exports (same data as the screens) ----------

export class ExportGradebookQuery extends Query<ExportFile> {
  constructor(
    public readonly classId: string,
    public readonly user: AuthUser,
    public readonly range: RangeArgs,
    public readonly format: ExportFormat,
  ) {
    super();
  }
}

export class ExportAssignmentQuery extends Query<ExportFile> {
  constructor(
    public readonly assignmentId: string,
    public readonly user: AuthUser,
    public readonly format: ExportFormat,
  ) {
    super();
  }
}

export class ExportStudentReportQuery extends Query<ExportFile> {
  constructor(
    public readonly classId: string,
    public readonly studentId: string,
    public readonly user: AuthUser,
    public readonly range: RangeArgs,
  ) {
    super();
  }
}
