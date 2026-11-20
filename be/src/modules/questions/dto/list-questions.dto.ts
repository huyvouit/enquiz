import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/utils/pagination.js';
import { QuestionType } from '../question-types.js';

export class ListQuestionsDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  topic?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  gradeLevel?: number;

  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

  /** Case-insensitive substring match on questionText. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  /** true => only questions created by the current teacher. */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  mine?: boolean;
}
