import { Controller, Get, Param, Query, StreamableFile } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsOptional } from 'class-validator';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../common/enums/role.enum.js';
import { ParseObjectIdPipe } from '../../common/pipes/parse-object-id.pipe.js';
import type { AuthUser } from '../../common/types/auth-user.js';
import { RateLimit } from '../../common/rate-limit/rate-limit.js';
import type {
  ExportFile,
  ExportFormat,
} from './export/report-export.service.js';
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
} from './queries/analytics.queries.js';

export class RangeQueryDto {
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}

export class ExportQueryDto extends RangeQueryDto {
  @IsOptional()
  @IsIn(['xlsx', 'pdf'])
  format: ExportFormat = 'xlsx';
}

/** Sends a generated file as a download (bypasses the JSON envelope). */
function download(file: ExportFile): StreamableFile {
  return new StreamableFile(file.buffer, {
    type: file.contentType,
    disposition: `attachment; filename="${file.fileName}"`,
    length: file.buffer.length,
  });
}

/** Teacher analytics (plan 3.3). Every handler checks the class is the teacher's. */
@Roles(Role.TEACHER, Role.ADMIN)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('classes/:id/overview')
  overview(
    @Param('id', ParseObjectIdPipe) id: string,
    @Query() q: RangeQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.queryBus.execute(new ClassOverviewQuery(id, user, q));
  }

  @Get('classes/:id/topics')
  topics(
    @Param('id', ParseObjectIdPipe) id: string,
    @Query() q: RangeQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.queryBus.execute(new TopicHeatmapQuery(id, user, q));
  }

  @Get('classes/:id/quizzes/:quizId/heatmap')
  quizHeatmap(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('quizId', ParseObjectIdPipe) quizId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.queryBus.execute(new ClassQuizHeatmapQuery(id, quizId, user));
  }

  @Get('classes/:id/students/:studentId')
  studentReport(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('studentId', ParseObjectIdPipe) studentId: string,
    @Query() q: RangeQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.queryBus.execute(
      new StudentReportQuery(id, studentId, user, q),
    );
  }

  @Get('classes/:id/gradebook')
  gradebook(
    @Param('id', ParseObjectIdPipe) id: string,
    @Query() q: RangeQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.queryBus.execute(new GradebookQuery(id, user, q));
  }

  @Get('assignments/:id/heatmap')
  assignmentHeatmap(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.queryBus.execute(new AssignmentHeatmapQuery(id, user));
  }

  // ---------- Downloads ----------

  @RateLimit('export', 20)
  @Get('classes/:id/gradebook/export')
  async exportGradebook(
    @Param('id', ParseObjectIdPipe) id: string,
    @Query() q: ExportQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return download(
      await this.queryBus.execute(
        new ExportGradebookQuery(
          id,
          user,
          { from: q.from, to: q.to },
          q.format,
        ),
      ),
    );
  }

  @RateLimit('export', 20)
  @Get('assignments/:id/export')
  async exportAssignment(
    @Param('id', ParseObjectIdPipe) id: string,
    @Query() q: ExportQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return download(
      await this.queryBus.execute(
        new ExportAssignmentQuery(id, user, q.format),
      ),
    );
  }

  @RateLimit('export', 20)
  @Get('classes/:id/students/:studentId/export')
  async exportStudentReport(
    @Param('id', ParseObjectIdPipe) id: string,
    @Param('studentId', ParseObjectIdPipe) studentId: string,
    @Query() q: RangeQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return download(
      await this.queryBus.execute(
        new ExportStudentReportQuery(id, studentId, user, q),
      ),
    );
  }
}
