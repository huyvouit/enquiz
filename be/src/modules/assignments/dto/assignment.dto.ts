import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDate,
  IsEnum,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { CLASS_MAX_STUDENTS } from '../../classes/schemas/class-room.schema.js';
import {
  AssignmentStatus,
  type AssignmentTargetKind,
} from '../schemas/assignment.schema.js';

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

export class CreateAssignmentDto {
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

export class UpdateAssignmentDto {
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
