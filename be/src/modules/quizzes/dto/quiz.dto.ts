import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { QuizStatus } from '../schemas/quiz.schema.js';

export const QUIZ_MAX_QUESTIONS = 50;

export class QuizSettingsDto {
  @IsOptional()
  @IsBoolean()
  shuffleQuestions?: boolean;
}

/** Used for both create (POST) and full update (PUT). */
export class QuizDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  topic: string;

  @IsInt()
  @Min(1)
  @Max(5)
  gradeLevel: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  coverEmoji?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Quiz phải có ít nhất 1 câu hỏi' })
  @ArrayMaxSize(QUIZ_MAX_QUESTIONS)
  @ArrayUnique()
  @IsMongoId({ each: true })
  questionIds: string[];

  @IsOptional()
  @IsEnum(QuizStatus)
  status?: QuizStatus;

  @IsOptional()
  @ValidateNested()
  @Type(() => QuizSettingsDto)
  settings?: QuizSettingsDto;
}
