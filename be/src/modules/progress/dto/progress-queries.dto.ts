import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import type { LeaderboardPeriod } from '../progression/progression.rules.js';

const PERIODS: LeaderboardPeriod[] = ['week', 'month', 'all'];

class GradeQueryDto {
  /** Defaults to the student's own grade (1 for teachers/admins). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  gradeLevel?: number;
}

export class MapQueryDto extends GradeQueryDto {}

export class LeaderboardQueryDto extends GradeQueryDto {
  @IsOptional()
  @IsIn(PERIODS)
  period: LeaderboardPeriod = 'week';

  /** grade: everyone in the grade, short names. class: one class, full names. */
  @IsOptional()
  @IsIn(['grade', 'class'])
  scope: 'grade' | 'class' = 'grade';

  @ValidateIf((o: LeaderboardQueryDto) => o.scope === 'class')
  @IsMongoId()
  classId?: string;
}
