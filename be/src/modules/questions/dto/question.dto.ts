import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  AUTHORABLE_QUESTION_TYPES,
  QUESTION_LIMITS,
  QuestionSkill,
  QuestionType,
  YleLevel,
} from '../question-types.js';

/** An http(s) URL or an image uploaded to this API. */
export const MEDIA_URL_PATTERN =
  /^(https?:\/\/\S+|\/api\/v1\/uploads\/images\/[\w.-]+)$/;

export class MatchPairDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  left: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  right: string;
}

/**
 * Used for both create (POST) and full update (PUT).
 * Shape checks live here; cross-field rules (answer is one of the options,
 * no duplicate pairs...) live in `assertValidQuestionContent`.
 */
export class QuestionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  topic: string;

  @IsInt()
  @Min(1)
  @Max(5)
  gradeLevel: number;

  @IsIn(AUTHORABLE_QUESTION_TYPES, {
    message: `type phải là một trong: ${AUTHORABLE_QUESTION_TYPES.join(', ')}`,
  })
  type: QuestionType;

  @IsOptional()
  @IsEnum(QuestionSkill)
  skill?: QuestionSkill;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  questionText: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(MEDIA_URL_PATTERN, {
    message: 'mediaUrl phải là đường dẫn ảnh hợp lệ',
  })
  mediaUrl?: string;

  /** English text read aloud by the browser (makes it a listening question). */
  @IsOptional()
  @IsString()
  @MaxLength(QUESTION_LIMITS.maxAudioText)
  audioText?: string;

  /** multiple_choice: the choices. fill_in_blank: optional word bank. */
  @ValidateIf(
    (o: QuestionDto) =>
      o.type === QuestionType.MULTIPLE_CHOICE ||
      (o.type === QuestionType.FILL_IN_BLANK && o.options !== undefined),
  )
  @IsArray()
  @ArrayMinSize(QUESTION_LIMITS.minOptions)
  @ArrayMaxSize(QUESTION_LIMITS.maxOptions)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(80, { each: true })
  options?: string[];

  @ValidateIf((o: QuestionDto) => o.type === QuestionType.MATCHING)
  @IsArray()
  @ArrayMinSize(QUESTION_LIMITS.minPairs)
  @ArrayMaxSize(QUESTION_LIMITS.maxPairs)
  @ValidateNested({ each: true })
  @Type(() => MatchPairDto)
  pairs?: MatchPairDto[];

  @ValidateIf((o: QuestionDto) => o.type === QuestionType.MULTIPLE_CHOICE)
  @IsString()
  @MinLength(1)
  correctAnswer?: string;

  /** fill_in_blank: every spelling accepted as correct (case-insensitive). */
  @ValidateIf((o: QuestionDto) => o.type === QuestionType.FILL_IN_BLANK)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(QUESTION_LIMITS.maxAcceptedAnswers)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  acceptedAnswers?: string[];

  /** ordering: the words/phrases in the correct order. */
  @ValidateIf((o: QuestionDto) => o.type === QuestionType.ORDERING)
  @IsArray()
  @ArrayMinSize(QUESTION_LIMITS.minOrderItems)
  @ArrayMaxSize(QUESTION_LIMITS.maxOrderItems)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  orderedItems?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(QUESTION_LIMITS.maxTags)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  tags?: string[];

  @IsOptional()
  @IsEnum(YleLevel)
  yleLevel?: YleLevel;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  unit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  explanation?: string;
}
