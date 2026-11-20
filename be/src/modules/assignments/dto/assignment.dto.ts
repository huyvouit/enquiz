import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDate,
  IsEnum,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { CLASS_MAX_STUDENTS } from '../../classes/schemas/class-room.schema.js';
import { EXAM_MAX_SEC, EXAM_MIN_SEC } from '../../../common/utils/exam-time.js';
import {
  AssignmentMode,
  AssignmentStatus,
  type AssignmentTargetKind,
  RevealPolicy,
} from '../schemas/assignment.schema.js';

/** Exam settings shared by create and update (plan E6, E12). */
class ExamSettingsDto {
  @IsOptional()
  @IsEnum(AssignmentMode)
  mode?: AssignmentMode;

  /** Exam: defaults to the quiz's suggested time, then 15 minutes. */
  @IsOptional()
  @IsInt()
  @Min(EXAM_MIN_SEC)
  @Max(EXAM_MAX_SEC)
  timeLimitSec?: number;

  @IsOptional()
  @IsEnum(RevealPolicy)
  reveal?: RevealPolicy;
}

export class AssignmentTargetDto {
  @IsIn(['class', 'group', 'students'])
  kind: AssignmentTargetKind;

  @ValidateIf((o: AssignmentTargetDto) => o.kind === 'group')
  @IsMongoId()
  groupId?: string;

  @ValidateIf((o: AssignmentTargetDto) => o.kind === 'students')
  @IsArray()
  @ArrayMinSize(1, { message: 'Hãy chọn ít nhất 1 học sinh' })
  @ArrayMaxSize(CLASS_MAX_STUDENTS)
  @ArrayUnique()
  @IsMongoId({ each: true })
  studentIds?: string[];
}

export class CreateAssignmentDto extends ExamSettingsDto {
  @IsMongoId()
  quizId: string;

  @ValidateNested()
  @Type(() => AssignmentTargetDto)
  target: AssignmentTargetDto;

  /** ISO date-time. The UI defaults to 20:00 Vietnam time of the picked day. */
  @Type(() => Date)
  @IsDate()
  dueDate: Date;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class UpdateAssignmentDto extends ExamSettingsDto {
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueDate?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;

  @IsOptional()
  @IsEnum(AssignmentStatus)
  status?: AssignmentStatus;
}

export class ListAssignmentsDto {
  @IsOptional()
  @IsIn(['active', 'closed', 'all'])
  status: 'active' | 'closed' | 'all' = 'all';
}
