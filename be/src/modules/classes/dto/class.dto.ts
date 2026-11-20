import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  CLASS_MAX_STUDENTS,
  ClassStatus,
} from '../schemas/class-room.schema.js';

export class CreateClassDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name: string;

  @IsInt()
  @Min(1)
  @Max(5)
  gradeLevel: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  schoolName?: string;
}

export class UpdateClassDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  gradeLevel?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  schoolName?: string;

  @IsOptional()
  @IsEnum(ClassStatus)
  status?: ClassStatus;
}

export class JoinClassDto {
  @IsString()
  @MinLength(4)
  @MaxLength(12)
  code: string;
}

export class BulkStudentsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(CLASS_MAX_STUDENTS)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(60, { each: true })
  fullNames: string[];
}

export class GroupDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name: string;

  @IsArray()
  @ArrayMaxSize(CLASS_MAX_STUDENTS)
  @ArrayUnique()
  @IsMongoId({ each: true })
  studentIds: string[];
}
